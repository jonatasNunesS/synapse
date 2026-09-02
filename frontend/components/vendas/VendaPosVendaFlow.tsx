"use client";
/**
 * Synapse — as perguntas que seguem uma venda recém-registrada.
 *
 * Registrar a venda não baixa estoque nem lança no financeiro sozinha: quem
 * decide é a pessoa. O que faltava era perguntar na hora. Até aqui as duas
 * ações só existiam no detalhe da venda, o que na prática as tornava
 * invisíveis — quem acabou de vender não vai fechar o formulário, achar a
 * linha na lista e clicar no nome do cliente.
 *
 * O encadeamento é o mesmo do fluxo antigo de interação: estoque primeiro
 * (opcional, e só quando há o que baixar), financeiro depois (a pergunta que
 * sempre vem). Responder "agora não" a qualquer uma delas não perde nada — as
 * duas continuam disponíveis no detalhe da venda.
 *
 * As duas guardas da fase 3A decidem o que sequer é perguntado:
 * venda sem item com produto não tem o que baixar, e venda que já tem
 * lançamento não gera outro. É o que protege as 22 vendas migradas na fase 2.
 */
import { useCallback, useEffect, useState } from "react";
import { Banknote, Loader2, PackageCheck, X } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/api";
import { vendaIntegracoes } from "@/hooks/useVendas";
import { useModulos } from "@/hooks/useModulos";
import { formatCurrency } from "@/lib/utils";
import type { PreviaEstoque, Venda } from "@/types/vendas";

type Etapa = "estoque" | "financeiro" | "fim";

interface Props {
  venda: Venda;
  /** Chamado a cada ação concluída, com a venda que o backend devolveu. */
  onAtualizada?: (venda: Venda) => void;
  /** Chamado quando não há mais nada a perguntar. */
  onFim: () => void;
}

/**
 * A primeira etapa que ainda faz sentido para esta venda.
 *
 * Calculada uma vez, na montagem: depois que a baixa acontece a venda muda de
 * forma, e recalcular faria a etapa se fechar sozinha antes de a pessoa ver o
 * resultado.
 */
function primeiraEtapa(venda: Venda, estoqueAtivo: boolean): Etapa {
  if (estoqueAtivo && venda.tem_itens_com_produto && !venda.ja_baixou_estoque) {
    return "estoque";
  }
  if (!venda.tem_lancamento_financeiro) return "financeiro";
  return "fim";
}

export function VendaPosVendaFlow({ venda: vendaInicial, onAtualizada, onFim }: Props) {
  const { moduloAtivo } = useModulos();
  const [etapaInicial] = useState<Etapa>(() =>
    primeiraEtapa(vendaInicial, moduloAtivo("estoque"))
  );
  const [venda, setVenda] = useState(vendaInicial);
  const [etapa, setEtapa] = useState<Etapa>(etapaInicial);

  const [previa, setPrevia] = useState<PreviaEstoque | null>(null);
  // Já nasce carregando quando a primeira etapa é o estoque: a busca da prévia
  // começa junto com a montagem, e ligar isso dentro do efeito só faria a tela
  // renderizar duas vezes para dizer a mesma coisa.
  const [carregandoPrevia, setCarregandoPrevia] = useState(etapaInicial === "estoque");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Ligado quando o backend recusa por saldo: oferece baixar o que há.
  const [ofereceParcial, setOfereceParcial] = useState(false);

  const registrar = useCallback(
    (atualizada: Venda) => {
      setVenda(atualizada);
      onAtualizada?.(atualizada);
    },
    [onAtualizada]
  );

  /** Estoque respondido (sim ou não) → a pergunta do financeiro, se couber. */
  const seguirDoEstoque = useCallback((atual: Venda) => {
    setEtapa(atual.tem_lancamento_financeiro ? "fim" : "financeiro");
  }, []);

  // Nada a perguntar: sai sem piscar um modal vazio na cara de quem vendeu.
  useEffect(() => {
    if (etapa === "fim") onFim();
  }, [etapa, onFim]);

  // A prévia é o ponto da pergunta: mostra o saldo antes e depois de cada
  // produto. Perguntar "baixar?" sem dizer do quê seria pedir um clique cego.
  useEffect(() => {
    if (etapa !== "estoque") return;
    let cancelado = false;
    vendaIntegracoes
      .previaEstoque(vendaInicial.id)
      .then((dados) => {
        if (!cancelado) setPrevia(dados);
      })
      .catch((err: unknown) => {
        if (!cancelado) setErro(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelado) setCarregandoPrevia(false);
      });
    return () => {
      cancelado = true;
    };
  }, [etapa, vendaInicial.id]);

  const baixar = async (parcial: boolean) => {
    if (processando) return;
    setErro(null);
    setProcessando(true);
    try {
      const atualizada = await vendaIntegracoes.baixarEstoque(venda.id, parcial);
      registrar(atualizada);
      toast.success("Estoque baixado.");
      seguirDoEstoque(atualizada);
    } catch (err: unknown) {
      setErro(getErrorMessage(err));
      // Saldo curto não é o fim: a pessoa pode baixar o que tem, como no
      // fluxo antigo. Só oferece depois que o backend recusou.
      setOfereceParcial(!parcial);
    } finally {
      setProcessando(false);
    }
  };

  const lancar = async () => {
    if (processando) return;
    setErro(null);
    setProcessando(true);
    try {
      const atualizada = await vendaIntegracoes.lancarFinanceiro(venda.id);
      registrar(atualizada);
      toast.success("Receita registrada no financeiro.");
      setEtapa("fim");
    } catch (err: unknown) {
      setErro(getErrorMessage(err));
    } finally {
      setProcessando(false);
    }
  };

  if (etapa === "fim") return null;

  const ehEstoque = etapa === "estoque";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        data-testid={ehEstoque ? "pos-venda-estoque" : "pos-venda-financeiro"}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            {ehEstoque ? (
              <PackageCheck className="h-5 w-5 text-brand-accent" />
            ) : (
              <Banknote className="h-5 w-5 text-sucesso" />
            )}
            <h3 className="text-base font-semibold text-foreground">
              {ehEstoque ? "Baixar do estoque?" : "Lançar no financeiro?"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => (ehEstoque ? seguirDoEstoque(venda) : setEtapa("fim"))}
            disabled={processando}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-superficie-forte hover:text-foreground disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {ehEstoque ? (
            <>
              <p className="text-sm text-foreground-suave">
                Venda registrada. Quer descontar os produtos do estoque agora?
              </p>
              {carregandoPrevia ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Conferindo o estoque...
                </p>
              ) : previa ? (
                <ul
                  data-testid="pos-venda-previa"
                  className="mt-3 space-y-1 rounded-lg border border-border bg-white/[0.03] px-4 py-3"
                >
                  {previa.itens.map((item) => (
                    <li
                      key={item.item_id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate text-foreground">{item.produto_nome}</span>
                      <span
                        className={item.suficiente ? "text-muted-foreground" : "text-alerta"}
                      >
                        {item.estoque_antes} → {item.estoque_depois}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm text-foreground-suave">
                Quer registrar a receita desta venda no financeiro?
              </p>
              <div className="mt-3 rounded-lg border border-border bg-white/[0.03] px-4 py-3">
                <p className="text-sm text-foreground">
                  Receita:{" "}
                  <span className="font-semibold text-sucesso">
                    {formatCurrency(venda.total)}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-suave">
                  {/* Balcão é o caso normal, não uma falha de cadastro. */}
                  Cliente: {venda.cliente_nome ?? "sem cliente"}
                </p>
              </div>
            </>
          )}

          {erro && (
            <p role="alert" className="mt-3 text-xs text-erro">
              {erro}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          <button
            type="button"
            onClick={() => (ehEstoque ? seguirDoEstoque(venda) : setEtapa("fim"))}
            disabled={processando}
            className="rounded-lg px-4 py-2 text-sm text-foreground-suave transition-colors hover:bg-superficie disabled:opacity-50"
          >
            Agora não
          </button>
          {ofereceParcial && ehEstoque && (
            <button
              type="button"
              onClick={() => baixar(true)}
              disabled={processando}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-alerta transition-colors hover:bg-amber-500/20 disabled:opacity-50"
            >
              Baixar só o que tem
            </button>
          )}
          <button
            type="button"
            onClick={() => (ehEstoque ? baixar(false) : lancar())}
            disabled={processando || (ehEstoque && carregandoPrevia)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60 ${
              ehEstoque
                ? "bg-brand-600 hover:bg-brand-500"
                : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            {processando && <Loader2 className="h-4 w-4 animate-spin" />}
            {ehEstoque ? "Sim, baixar do estoque" : "Sim, registrar receita"}
          </button>
        </div>
      </div>
    </div>
  );
}

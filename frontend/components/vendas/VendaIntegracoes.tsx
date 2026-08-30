"use client";
/**
 * Synapse — As duas integrações da venda: estoque e financeiro.
 *
 * As duas PERGUNTAM antes de agir, como sempre foi no fluxo antigo. A baixa de
 * estoque mostra o saldo de cada produto antes e depois; o lançamento mostra o
 * valor que vai para o caixa. Nada acontece por criar a venda.
 *
 * Duas situações desligam as ações, e as duas são as vendas migradas na fase 2:
 * venda sem item com produto não tem o que baixar, e venda que já tem
 * lançamento não gera outro — a receita dela já está contada.
 */
import { useState } from "react";
import { Banknote, Check, Loader2, PackageCheck } from "lucide-react";

import { getErrorMessage } from "@/lib/api";
import { vendaIntegracoes } from "@/hooks/useVendas";
import { formatCurrency } from "@/lib/utils";
import type { PreviaEstoque, Venda } from "@/types/vendas";

interface Props {
  venda: Venda;
  /** Chamado depois de baixar ou lançar, para a tela reler a venda. */
  onAtualizada: (venda: Venda) => void;
}

export function VendaIntegracoes({ venda, onAtualizada }: Props) {
  const [previa, setPrevia] = useState<PreviaEstoque | null>(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [enviando, setEnviando] = useState<"estoque" | "financeiro" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Ligado quando o backend recusa por saldo: oferece baixar o que há.
  const [ofereceParcial, setOfereceParcial] = useState(false);

  const abrirPrevia = async () => {
    setErro(null);
    setOfereceParcial(false);
    setCarregandoPrevia(true);
    try {
      setPrevia(await vendaIntegracoes.previaEstoque(venda.id));
    } catch (err: unknown) {
      setErro(getErrorMessage(err));
    } finally {
      setCarregandoPrevia(false);
    }
  };

  const baixar = async (parcial: boolean) => {
    setErro(null);
    setEnviando("estoque");
    try {
      onAtualizada(await vendaIntegracoes.baixarEstoque(venda.id, parcial));
      setPrevia(null);
      setOfereceParcial(false);
    } catch (err: unknown) {
      setErro(getErrorMessage(err));
      // Saldo curto não é o fim: a pessoa pode baixar o que tem, como no
      // fluxo antigo. Só oferece depois que o backend recusou.
      setOfereceParcial(!parcial);
    } finally {
      setEnviando(null);
    }
  };

  const lancar = async () => {
    setErro(null);
    setEnviando("financeiro");
    try {
      onAtualizada(await vendaIntegracoes.lancarFinanceiro(venda.id));
    } catch (err: unknown) {
      setErro(getErrorMessage(err));
    } finally {
      setEnviando(null);
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border bg-superficie p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Integrações
      </h3>

      {/* ── Estoque ── */}
      <div>
        {venda.ja_baixou_estoque ? (
          <p
            data-testid="estoque-ja-baixado"
            className="flex items-center gap-1.5 text-sm text-sucesso"
          >
            <Check className="h-4 w-4" />
            Estoque já baixado
          </p>
        ) : !venda.tem_itens_com_produto ? (
          // Venda só de item livre (serviço, ou venda migrada da fase 2).
          <p
            data-testid="estoque-sem-produto"
            className="text-sm text-muted-foreground"
          >
            Sem item de estoque nesta venda.
          </p>
        ) : previa ? (
          <div data-testid="previa-estoque" className="space-y-2">
            <ul className="space-y-1">
              {previa.itens.map((item) => (
                <li
                  key={item.item_id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate text-foreground">{item.produto_nome}</span>
                  <span
                    className={
                      item.suficiente ? "text-muted-foreground" : "text-alerta"
                    }
                  >
                    {item.estoque_antes} → {item.estoque_depois}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => baixar(false)}
                disabled={enviando !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-40"
              >
                {enviando === "estoque" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirmar baixa
              </button>
              <button
                type="button"
                onClick={() => setPrevia(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={abrirPrevia}
            disabled={carregandoPrevia}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-superficie-forte disabled:opacity-40"
          >
            {carregandoPrevia ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PackageCheck className="h-3.5 w-3.5" />
            )}
            Baixar do estoque
          </button>
        )}

        {ofereceParcial && (
          <button
            type="button"
            onClick={() => baixar(true)}
            disabled={enviando !== null}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-alerta transition-colors hover:bg-amber-500/20 disabled:opacity-40"
          >
            Baixar só o que tem em estoque
          </button>
        )}
      </div>

      {/* ── Financeiro ── */}
      <div className="border-t border-border pt-3">
        {venda.tem_lancamento_financeiro ? (
          <p
            data-testid="financeiro-ja-lancado"
            className="flex items-center gap-1.5 text-sm text-sucesso"
          >
            <Check className="h-4 w-4" />
            Já lançado no financeiro
          </p>
        ) : (
          <button
            type="button"
            onClick={lancar}
            disabled={enviando !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-superficie-forte disabled:opacity-40"
          >
            {enviando === "financeiro" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Banknote className="h-3.5 w-3.5" />
            )}
            Lançar {formatCurrency(venda.total)} no financeiro
          </button>
        )}
      </div>

      {erro && (
        <p role="alert" className="text-xs text-erro">
          {erro}
        </p>
      )}
    </div>
  );
}

"use client";
/**
 * Synapse — Detalhe da venda: os itens que a compõem.
 *
 * Os valores exibidos aqui são os que o backend gravou — não recalculamos
 * nada na leitura. Se a soma das linhas não bater com o total, o problema é
 * de dado, e escondê-lo com uma conta local seria pior.
 */
import { useEffect } from "react";
import { UserCog, X } from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/utils";
import { FORMAS_PAGAMENTO, type Venda } from "@/types/vendas";

import { temCobrancaAberta } from "@/lib/vendaStatus";
import { VendaIntegracoes } from "./VendaIntegracoes";
import { CompromissosVinculados } from "@/components/agenda/CompromissosVinculados";
import { useEventosDaVenda } from "@/hooks/useAgenda";
import { useModulos } from "@/hooks/useModulos";

interface Props {
  venda: Venda;
  onClose: () => void;
  /** Baixar estoque ou lançar financeiro devolve a venda atualizada. */
  onAtualizada?: (venda: Venda) => void;
  /** Mexer em de quem foi a venda. Sem isto, o detalhe é só leitura. */
  onTrocarCliente?: (venda: Venda) => void;
  /**
   * Registrar o que entrou de uma venda fiada.
   *
   * Até aqui só dava para fazer isso quando a notificação do dia chegava
   * (`/vendas?fiado=<id>`) ou pelo botão "Cobrar" da lista, que só aparece no
   * hover. Quem pagou antes do vencimento não tinha por onde ser registrado,
   * e o detalhe da venda — que é a página dela — não oferecia nada.
   */
  onRegistrarRecebimento?: (venda: Venda) => void;
}

function rotuloForma(valor: string): string {
  return FORMAS_PAGAMENTO.find((f) => f.valor === valor)?.rotulo ?? "Não informada";
}

export function VendaDetalheModal({
  venda,
  onClose,
  onAtualizada,
  onRegistrarRecebimento,
  onTrocarCliente,
}: Props) {
  // Os compromissos vinculados a esta venda.
  const { moduloAtivo } = useModulos();
  const agendaAtiva = moduloAtivo("agenda");
  const {
    eventos: compromissos,
    loading: compromissosCarregando,
    carregadoEm: compromissosCarregadosEm,
    carregar: carregarCompromissos,
  } = useEventosDaVenda(venda.id);

  useEffect(() => {
    // Falhar aqui não pode derrubar o detalhe da venda: sem a seção, o modal é
    // o que já era.
    if (agendaAtiva) carregarCompromissos().catch(() => {});
  }, [agendaAtiva, carregarCompromissos]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="my-8 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-elevacao-lg">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Venda</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              {formatDate(venda.data_venda)}
              {" · "}
              {venda.cliente_nome ?? "Sem cliente"}
              {onTrocarCliente && (
                <button
                  type="button"
                  onClick={() => onTrocarCliente(venda)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-brand-accent transition-colors hover:bg-brand-400/10"
                >
                  <UserCog className="h-3 w-3" />
                  {venda.cliente_nome ? "trocar" : "vincular"}
                </button>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="mb-4 space-y-2">
          {venda.itens.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-superficie px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.produto_nome}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.quantidade} {item.produto_unidade} ×{" "}
                  {formatCurrency(item.preco_unitario)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium text-foreground">
                {formatCurrency(item.subtotal)}
              </span>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-border bg-superficie p-4 text-sm">
          <div className="mb-1.5 flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">{formatCurrency(venda.subtotal)}</span>
          </div>
          <div className="mb-3 flex justify-between">
            <span className="text-muted-foreground">Desconto</span>
            <span className="text-foreground">{formatCurrency(venda.desconto)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
            <span className="text-foreground">Total</span>
            <span className="text-foreground">{formatCurrency(venda.total)}</span>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Pagamento</dt>
            <dd className="text-foreground">{rotuloForma(venda.forma_pagamento)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Situação</dt>
            <dd className="text-foreground">
              {venda.status_pagamento === "pago" ? "Pago" : "Pendente"}
            </dd>
          </div>
        </dl>

        {venda.observacoes && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-foreground-suave">
            {venda.observacoes}
          </p>
        )}

        {onRegistrarRecebimento && temCobrancaAberta(venda) && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Falta receber {formatCurrency(venda.saldo_devedor)}
                </p>
                {venda.data_prevista_pagamento && (
                  <p className="text-xs text-muted-foreground">
                    Previsto para {formatDate(venda.data_prevista_pagamento)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRegistrarRecebimento(venda)}
                className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-alerta transition-colors hover:bg-amber-500/20"
              >
                Registrar recebimento
              </button>
            </div>
          </div>
        )}

        {onAtualizada && (
          <VendaIntegracoes venda={venda} onAtualizada={onAtualizada} />
        )}

        {/* Os compromissos vinculados a esta venda (Fase B da agenda).
            A venda não tem página própria — este modal É o detalhe dela, então
            é aqui que a seção mora. Só aparece com o módulo Agenda ligado. */}
        {agendaAtiva && (
          <div className="mt-4">
            <CompromissosVinculados
              eventos={compromissos}
              loading={compromissosCarregando}
              agora={compromissosCarregadosEm}
              vazioSufixo="nesta venda"
            />
          </div>
        )}
      </div>
    </div>
  );
}

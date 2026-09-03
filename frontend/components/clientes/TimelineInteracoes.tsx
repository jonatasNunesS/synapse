"use client";
/**
 * O histórico do cliente — duas origens numa linha do tempo só.
 *
 * Interações (ligação, reunião, e as vendas do fluxo antigo ainda não
 * migradas) e Vendas dividem a mesma lista, ordenadas juntas. Cada linha sabe
 * de onde veio, e é isso que decide o que ela oferece: interação edita e
 * apaga aqui; venda abre o detalhe, onde estão as integrações dela.
 *
 * A mesma compra NÃO aparece duas vezes: o backend já tira da lista de
 * interações aquelas que a migração da fase 2 converteu em Venda. A dedup mora
 * lá, junto do dado — aqui só se ordena.
 */
import { Plus, Pencil, Receipt, Trash2, PackageCheck, PackageX } from "lucide-react";
import type { InteracaoCliente } from "@/types/clientes";
import { TIPO_INTERACAO_LABELS, TIPO_INTERACAO_ICONS } from "@/types/clientes";
import type { EntradaHistorico } from "@/lib/vendas";
import { badgePagamentoVenda } from "@/lib/vendaStatus";
import type { Venda } from "@/types/vendas";
import { useModulos } from "@/hooks/useModulos";
import { formatCurrencyOrNull } from "@/lib/utils";

/** Opções do filtro de controle de estoque (perfil do cliente). */
export type FiltroEstoque = "" | "descontados" | "nao_descontados";

interface TimelineInteracoesProps {
  /** Interações e vendas já misturadas e ordenadas (ver `montarHistorico`). */
  entradas: EntradaHistorico[];
  loading?: boolean;
  onNovaInteracao?: () => void;
  onEditar?: (interacao: InteracaoCliente) => void;
  onApagar?: (interacao: InteracaoCliente) => void;
  /** Descontar do estoque agora (venda sem baixa) — reabre o modal de produto. */
  onDescontarEstoque?: (interacao: InteracaoCliente) => void;
  /** Abrir o detalhe da venda, onde ficam as integrações dela. */
  onVerVenda?: (venda: Venda) => void;
  filtroEstoque?: FiltroEstoque;
  onFiltroEstoqueChange?: (valor: FiltroEstoque) => void;
}

/**
 * Uma venda com valor precisa de controle de estoque. Retorna o estado:
 * "descontado" (tem movimentação), "pendente" (venda com valor e sem baixa)
 * ou null (não é venda / sem valor → sem badge).
 */
function estadoEstoque(
  interacao: InteracaoCliente
): "descontado" | "pendente" | null {
  if (interacao.movimentacao_estoque_info) return "descontado";
  const valorNum = interacao.valor ? parseFloat(interacao.valor) : 0;
  if (interacao.tipo === "venda" && valorNum > 0) return "pendente";
  return null;
}

/**
 * O mesmo para a Venda como entidade.
 *
 * Venda só de item livre (serviço, ou venda migrada na fase 2) não tem o que
 * descontar — e por isso não recebe badge nenhum, em vez de aparecer para
 * sempre como "não descontada".
 */
function estadoEstoqueVenda(venda: Venda): "descontado" | "pendente" | null {
  if (venda.ja_baixou_estoque) return "descontado";
  if (venda.tem_itens_com_produto) return "pendente";
  return null;
}

function formatDateTime(dt: string): string {
  return new Date(dt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Venda guarda só a data — mostrar uma hora inventada seria pior que omitir. */
function formatDate(data: string): string {
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}

const BADGE = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.625rem] font-medium";
const BADGE_OK = "bg-emerald-500/15 text-sucesso border-emerald-500/30";
const BADGE_ALERTA = "bg-amber-500/15 text-alerta border-amber-500/30";
const BADGE_ERRO = "bg-red-500/15 text-erro border-red-500/30";
const BADGE_NEUTRO = "bg-zinc-500/15 text-muted-foreground border-zinc-500/30";

/** As classes de cada tom do badge de pagamento da venda. */
const TOM_BADGE: Record<string, string> = {
  sucesso: BADGE_OK,
  alerta: BADGE_ALERTA,
  erro: BADGE_ERRO,
  neutro: BADGE_NEUTRO,
};

/** Badge de status de pagamento. Retorna null quando não se aplica. */
function badgePagamento(
  interacao: InteracaoCliente
): { label: string; className: string } | null {
  const { status_pagamento, pagamento_atrasado, dias_para_vencer } = interacao;
  if (status_pagamento === "pago") {
    return { label: "Pago", className: BADGE_OK };
  }
  if (status_pagamento === "cancelado") {
    return { label: "Cancelado", className: BADGE_NEUTRO };
  }
  if (status_pagamento === "pendente") {
    if (pagamento_atrasado) {
      return { label: "Atrasado", className: BADGE_ERRO };
    }
    if (typeof dias_para_vencer === "number") {
      const label =
        dias_para_vencer === 0
          ? "Vence hoje"
          : `Vence em ${dias_para_vencer} dia${dias_para_vencer === 1 ? "" : "s"}`;
      return { label, className: BADGE_ALERTA };
    }
    return { label: "Pendente", className: BADGE_ALERTA };
  }
  return null; // nao_se_aplica
}

function BadgeEstoque({ estado }: { estado: "descontado" | "pendente" }) {
  return estado === "descontado" ? (
    <span className={`${BADGE} ${BADGE_OK}`}>
      <PackageCheck className="w-3 h-3" />
      Estoque descontado
    </span>
  ) : (
    <span className={`${BADGE} ${BADGE_ALERTA}`}>
      <PackageX className="w-3 h-3" />
      Não descontado
    </span>
  );
}

/** A casca de uma linha: o ícone na trilha e o cartão ao lado. */
function Linha({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 relative">
      <div className="w-8 h-8 rounded-full bg-[#1a1d27] border border-border flex items-center justify-center flex-shrink-0 z-10 text-base">
        {icone}
      </div>
      <div className="flex-1 bg-superficie border border-border rounded-xl p-3 min-w-0">
        {children}
      </div>
    </div>
  );
}

function LinhaInteracao({
  interacao,
  mostrarEstoque,
  onEditar,
  onApagar,
  onDescontarEstoque,
}: {
  interacao: InteracaoCliente;
  mostrarEstoque: boolean;
  onEditar?: (i: InteracaoCliente) => void;
  onApagar?: (i: InteracaoCliente) => void;
  onDescontarEstoque?: (i: InteracaoCliente) => void;
}) {
  const badge = badgePagamento(interacao);
  const estado = mostrarEstoque ? estadoEstoque(interacao) : null;

  return (
    <Linha icone={TIPO_INTERACAO_ICONS[interacao.tipo]}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-brand-accent uppercase tracking-wide">
              {TIPO_INTERACAO_LABELS[interacao.tipo]}
            </span>
            {badge && (
              <span className={`${BADGE} ${badge.className}`}>{badge.label}</span>
            )}
            {estado && <BadgeEstoque estado={estado} />}
          </div>
          <h4 className="text-sm font-medium text-foreground mt-0.5">
            {interacao.titulo}
          </h4>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {interacao.valor && (
            <span className="text-sm font-semibold text-sucesso">
              {formatCurrencyOrNull(interacao.valor)}
            </span>
          )}
          {onEditar && (
            <button
              onClick={() => onEditar(interacao)}
              title="Editar interação"
              className="p-1 text-muted-suave hover:text-brand-accent hover:bg-superficie-forte rounded transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onApagar && (
            <button
              onClick={() => onApagar(interacao)}
              title="Excluir interação"
              className="p-1 text-muted-suave hover:text-erro hover:bg-superficie-forte rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {interacao.descricao && (
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {interacao.descricao}
        </p>
      )}

      {estado === "pendente" && onDescontarEstoque && (
        <button
          onClick={() => onDescontarEstoque(interacao)}
          className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-[0.6875rem] text-alerta font-medium transition-colors"
        >
          <PackageCheck className="w-3.5 h-3.5" />
          Descontar do estoque agora
        </button>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <span className="text-xs text-muted-suave">
          {formatDateTime(interacao.data_interacao)}
          {interacao.criado_por_nome && (
            <span className="ml-1">• {interacao.criado_por_nome}</span>
          )}
        </span>
        {interacao.proximo_followup && (
          <span className="text-xs text-alerta">
            Follow-up:{" "}
            {new Date(interacao.proximo_followup).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>
    </Linha>
  );
}

function LinhaVenda({
  venda,
  mostrarEstoque,
  onVerVenda,
}: {
  venda: Venda;
  mostrarEstoque: boolean;
  onVerVenda?: (v: Venda) => void;
}) {
  const estado = mostrarEstoque ? estadoEstoqueVenda(venda) : null;
  const itens = venda.itens.map((item) => item.produto_nome).join(", ");

  return (
    <Linha icone={<Receipt className="w-4 h-4 text-brand-accent" />}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-brand-accent uppercase tracking-wide">
              Venda
            </span>
            {(() => {
              // Mesma regra da lista de Vendas: quem calcula é o lib, para as
              // duas telas nunca discordarem sobre a mesma venda.
              const badge = badgePagamentoVenda(venda);
              return (
                <span className={`${BADGE} ${TOM_BADGE[badge.tom]}`}>
                  {badge.label}
                </span>
              );
            })()}
            {estado && <BadgeEstoque estado={estado} />}
            {venda.tem_lancamento_financeiro && (
              <span className={`${BADGE} ${BADGE_OK}`}>No financeiro</span>
            )}
          </div>
          <h4 className="text-sm font-medium text-foreground mt-0.5">
            {venda.itens.length} item{venda.itens.length !== 1 ? "ns" : ""}
          </h4>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-semibold text-sucesso">
            {formatCurrencyOrNull(venda.total)}
          </span>
        </div>
      </div>

      {itens && (
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{itens}</p>
      )}

      {onVerVenda && (
        <button
          onClick={() => onVerVenda(venda)}
          className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-superficie-forte hover:bg-white/[0.06] border border-border rounded-lg text-[0.6875rem] text-foreground-suave font-medium transition-colors"
        >
          Ver venda
        </button>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <span className="text-xs text-muted-suave">{formatDate(venda.data_venda)}</span>
      </div>
    </Linha>
  );
}

export function TimelineInteracoes({
  entradas,
  loading,
  onNovaInteracao,
  onEditar,
  onApagar,
  onDescontarEstoque,
  onVerVenda,
  filtroEstoque = "",
  onFiltroEstoqueChange,
}: TimelineInteracoesProps) {
  // Módulo Estoque desligado → a timeline não fala de estoque (nem badge,
  // nem filtro, nem a ação de descontar).
  const { moduloAtivo } = useModulos();
  const mostrarEstoque = moduloAtivo("estoque");
  return (
    <div className="bg-card shadow-elevacao border border-border rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Histórico de Interações</h3>
        <div className="flex items-center gap-2">
          {mostrarEstoque && onFiltroEstoqueChange && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="hidden sm:inline">Estoque</span>
              <select
                value={filtroEstoque}
                onChange={(e) =>
                  onFiltroEstoqueChange(e.target.value as FiltroEstoque)
                }
                className="bg-superficie border border-border rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-500/50"
              >
                <option value="">Todos</option>
                <option value="descontados">Descontados</option>
                <option value="nao_descontados">Não descontados</option>
              </select>
            </label>
          )}
          <button
            onClick={onNovaInteracao}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Interação
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-superficie animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-superficie rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-superficie rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : entradas.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-suave text-sm">Nenhuma interação registrada.</p>
            <button
              onClick={onNovaInteracao}
              className="mt-3 text-brand-accent hover:text-brand-accent text-sm transition-colors"
            >
              Registrar primeira interação
            </button>
          </div>
        ) : (
          <div className="relative">
            {/* Linha vertical da timeline */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-superficie-forte" />

            <div className="space-y-4">
              {entradas.map((entrada) =>
                entrada.origem === "venda" ? (
                  <LinhaVenda
                    key={`venda-${entrada.id}`}
                    venda={entrada.venda}
                    mostrarEstoque={mostrarEstoque}
                    onVerVenda={onVerVenda}
                  />
                ) : (
                  <LinhaInteracao
                    key={`interacao-${entrada.id}`}
                    interacao={entrada.interacao}
                    mostrarEstoque={mostrarEstoque}
                    onEditar={onEditar}
                    onApagar={onApagar}
                    onDescontarEstoque={onDescontarEstoque}
                  />
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

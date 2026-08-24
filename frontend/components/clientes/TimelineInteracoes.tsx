"use client";

import { Plus, Pencil, Trash2, PackageCheck, PackageX } from "lucide-react";
import type { InteracaoCliente } from "@/types/clientes";
import { TIPO_INTERACAO_LABELS, TIPO_INTERACAO_ICONS } from "@/types/clientes";
import { useModulos } from "@/hooks/useModulos";
import { formatCurrencyOrNull } from "@/lib/utils";

/** Opções do filtro de controle de estoque (perfil do cliente). */
export type FiltroEstoque = "" | "descontados" | "nao_descontados";

interface TimelineInteracoesProps {
  interacoes: InteracaoCliente[];
  loading?: boolean;
  onNovaInteracao?: () => void;
  onEditar?: (interacao: InteracaoCliente) => void;
  onApagar?: (interacao: InteracaoCliente) => void;
  /** Descontar do estoque agora (venda sem baixa) — reabre o modal de produto. */
  onDescontarEstoque?: (interacao: InteracaoCliente) => void;
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

function formatDateTime(dt: string): string {
  return new Date(dt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


/** Badge de status de pagamento. Retorna null quando não se aplica. */
function badgePagamento(
  interacao: InteracaoCliente
): { label: string; className: string } | null {
  const { status_pagamento, pagamento_atrasado, dias_para_vencer } = interacao;
  if (status_pagamento === "pago") {
    return { label: "Pago", className: "bg-emerald-500/15 text-sucesso border-emerald-500/30" };
  }
  if (status_pagamento === "cancelado") {
    return { label: "Cancelado", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30" };
  }
  if (status_pagamento === "pendente") {
    if (pagamento_atrasado) {
      return { label: "Atrasado", className: "bg-red-500/15 text-erro border-red-500/30" };
    }
    if (typeof dias_para_vencer === "number") {
      const label =
        dias_para_vencer === 0
          ? "Vence hoje"
          : `Vence em ${dias_para_vencer} dia${dias_para_vencer === 1 ? "" : "s"}`;
      return { label, className: "bg-amber-500/15 text-alerta border-amber-500/30" };
    }
    return { label: "Pendente", className: "bg-amber-500/15 text-alerta border-amber-500/30" };
  }
  return null; // nao_se_aplica
}

export function TimelineInteracoes({
  interacoes,
  loading,
  onNovaInteracao,
  onEditar,
  onApagar,
  onDescontarEstoque,
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
        ) : interacoes.length === 0 ? (
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
              {interacoes.map((interacao) => (
                <div key={interacao.id} className="flex gap-4 relative">
                  {/* Ícone */}
                  <div className="w-8 h-8 rounded-full bg-[#1a1d27] border border-border flex items-center justify-center flex-shrink-0 z-10 text-base">
                    {TIPO_INTERACAO_ICONS[interacao.tipo]}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 bg-superficie border border-border rounded-xl p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-brand-accent uppercase tracking-wide">
                            {TIPO_INTERACAO_LABELS[interacao.tipo]}
                          </span>
                          {(() => {
                            const badge = badgePagamento(interacao);
                            return badge ? (
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.625rem] font-medium ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            ) : null;
                          })()}
                          {(() => {
                            const estado = mostrarEstoque
                              ? estadoEstoque(interacao)
                              : null;
                            if (estado === "descontado") {
                              return (
                                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.625rem] font-medium bg-emerald-500/15 text-sucesso border-emerald-500/30">
                                  <PackageCheck className="w-3 h-3" />
                                  Estoque descontado
                                </span>
                              );
                            }
                            if (estado === "pendente") {
                              return (
                                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.625rem] font-medium bg-amber-500/15 text-alerta border-amber-500/30">
                                  <PackageX className="w-3 h-3" />
                                  Não descontado
                                </span>
                              );
                            }
                            return null;
                          })()}
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

                    {mostrarEstoque &&
                      estadoEstoque(interacao) === "pendente" &&
                      onDescontarEstoque && (
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

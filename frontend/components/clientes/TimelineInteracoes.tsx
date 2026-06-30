"use client";

import { Plus, Pencil, Trash2 } from "lucide-react";
import type { InteracaoCliente } from "@/types/clientes";
import { TIPO_INTERACAO_LABELS, TIPO_INTERACAO_ICONS } from "@/types/clientes";

interface TimelineInteracoesProps {
  interacoes: InteracaoCliente[];
  loading?: boolean;
  onNovaInteracao?: () => void;
  onEditar?: (interacao: InteracaoCliente) => void;
  onApagar?: (interacao: InteracaoCliente) => void;
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

function formatCurrency(value: string | null): string | null {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

export function TimelineInteracoes({
  interacoes,
  loading,
  onNovaInteracao,
  onEditar,
  onApagar,
}: TimelineInteracoesProps) {
  return (
    <div className="bg-[#0f1117] border border-white/10 rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">Histórico de Interações</h3>
        <button
          onClick={onNovaInteracao}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs text-white font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova Interação
        </button>
      </div>

      {/* Timeline */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-white/5 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : interacoes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">Nenhuma interação registrada.</p>
            <button
              onClick={onNovaInteracao}
              className="mt-3 text-purple-400 hover:text-purple-300 text-sm transition-colors"
            >
              Registrar primeira interação
            </button>
          </div>
        ) : (
          <div className="relative">
            {/* Linha vertical da timeline */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />

            <div className="space-y-4">
              {interacoes.map((interacao) => (
                <div key={interacao.id} className="flex gap-4 relative">
                  {/* Ícone */}
                  <div className="w-8 h-8 rounded-full bg-[#1a1d27] border border-white/10 flex items-center justify-center flex-shrink-0 z-10 text-base">
                    {TIPO_INTERACAO_ICONS[interacao.tipo]}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 bg-white/3 border border-white/8 rounded-xl p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <span className="text-xs font-medium text-purple-400 uppercase tracking-wide">
                          {TIPO_INTERACAO_LABELS[interacao.tipo]}
                        </span>
                        <h4 className="text-sm font-medium text-white mt-0.5">
                          {interacao.titulo}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {interacao.valor && (
                          <span className="text-sm font-semibold text-green-400">
                            {formatCurrency(interacao.valor)}
                          </span>
                        )}
                        {onEditar && (
                          <button
                            onClick={() => onEditar(interacao)}
                            title="Editar interação"
                            className="p-1 text-gray-500 hover:text-purple-400 hover:bg-white/10 rounded transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onApagar && (
                          <button
                            onClick={() => onApagar(interacao)}
                            title="Excluir interação"
                            className="p-1 text-gray-500 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {interacao.descricao && (
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        {interacao.descricao}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                      <span className="text-xs text-gray-500">
                        {formatDateTime(interacao.data_interacao)}
                        {interacao.criado_por_nome && (
                          <span className="ml-1">• {interacao.criado_por_nome}</span>
                        )}
                      </span>
                      {interacao.proximo_followup && (
                        <span className="text-xs text-yellow-400">
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

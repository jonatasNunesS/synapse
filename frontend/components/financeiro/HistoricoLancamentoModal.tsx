"use client";

/**
 * Synapse — Histórico de alterações de um lançamento (log de auditoria).
 *
 * Timeline com cada LogEdicaoLancamento: quem, quando, motivo e a lista
 * de campos alterados (antes → depois). Visível a qualquer usuário da
 * empresa — transparência sobre edições em lançamentos pagos.
 */

import { useEffect } from "react";
import { History, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useHistoricoLancamento } from "@/hooks/useFinanceiro";
import type {
  Lancamento,
  LogEdicaoLancamento,
  SnapshotLancamento,
} from "@/types/financeiro";

interface HistoricoLancamentoModalProps {
  lancamento: Lancamento;
  onClose: () => void;
}

const LABELS: Record<keyof SnapshotLancamento, string> = {
  id: "ID",
  tipo: "Tipo",
  descricao: "Descrição",
  valor: "Valor",
  categoria_id: "Categoria (id)",
  categoria_nome: "Categoria",
  data_vencimento: "Vencimento",
  data_pagamento: "Pagamento",
  status: "Status",
  recorrente: "Recorrente",
  recorrencia: "Recorrência",
  observacoes: "Observações",
};

// Campos exibidos no diff (id/categoria_id são redundantes com categoria_nome)
const CAMPOS_DIFF: (keyof SnapshotLancamento)[] = [
  "descricao",
  "valor",
  "categoria_nome",
  "data_vencimento",
  "data_pagamento",
  "status",
  "recorrente",
  "recorrencia",
  "observacoes",
];

function formatarValorCampo(campo: keyof SnapshotLancamento, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (campo === "valor") {
    const n = parseFloat(String(v));
    if (!isNaN(n)) {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(n);
    }
  }
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
}

function camposAlterados(log: LogEdicaoLancamento) {
  if (!log.snapshot_depois) return [];
  return CAMPOS_DIFF.filter(
    (campo) =>
      String(log.snapshot_antes[campo] ?? "") !==
      String(log.snapshot_depois![campo] ?? "")
  ).map((campo) => ({
    campo,
    label: LABELS[campo],
    antes: formatarValorCampo(campo, log.snapshot_antes[campo]),
    depois: formatarValorCampo(campo, log.snapshot_depois![campo]),
  }));
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function HistoricoLancamentoModal({
  lancamento,
  onClose,
}: HistoricoLancamentoModalProps) {
  const { logs, loading, error, carregar } = useHistoricoLancamento();

  useEffect(() => {
    carregar(lancamento.id);
  }, [carregar, lancamento.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <History className="w-5 h-5 text-brand-accent" />
              Histórico de alterações
            </h2>
            <p className="text-xs text-muted-suave mt-0.5">{lancamento.descricao}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-superficie-forte transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Carregando histórico...
            </div>
          ) : error ? (
            <p className="text-sm text-erro text-center py-6">{error}</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-suave text-center py-8">
              Este lançamento nunca foi editado.
            </p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-2 bottom-2 w-px bg-superficie-forte" />
              <div className="space-y-5">
                {logs.map((log) => {
                  const alteracoes = camposAlterados(log);
                  return (
                    <div key={log.id} className="flex gap-4 relative">
                      <div
                        className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 z-10 ${
                          log.acao === "excluido"
                            ? "bg-red-500/10 border-red-500/30 text-erro"
                            : "bg-brand-500/10 border-brand-500/30 text-brand-accent"
                        }`}
                      >
                        {log.acao === "excluido" ? (
                          <Trash2 className="w-3.5 h-3.5" />
                        ) : (
                          <Pencil className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="flex-1 bg-white/[0.03] border border-border rounded-xl p-3 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {log.acao_display} por {log.editado_por_nome ?? "—"}{" "}
                          <span className="text-muted-foreground font-normal">
                            em {formatarDataHora(log.editado_em)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Motivo: &ldquo;{log.motivo}&rdquo;
                        </p>

                        {log.acao === "editado" && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Alterações:
                            </p>
                            {alteracoes.length === 0 ? (
                              <p className="text-xs text-muted-suave">
                                Nenhum campo alterado.
                              </p>
                            ) : (
                              <ul className="space-y-0.5">
                                {alteracoes.map((a) => (
                                  <li key={a.campo} className="text-xs text-foreground-suave">
                                    <span className="text-muted-suave">{a.label}:</span>{" "}
                                    {a.antes}{" "}
                                    <span className="text-muted-suave">→</span>{" "}
                                    <span className="text-foreground">{a.depois}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

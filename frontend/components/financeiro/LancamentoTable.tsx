"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  History,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import type { Lancamento, StatusLancamento } from "@/types/financeiro";

interface LancamentoTableProps {
  lancamentos: Lancamento[];
  loading?: boolean;
  /**
   * Perfil admin habilita editar/excluir lançamentos PAGOS (fluxo auditado).
   *
   * Obrigatória de propósito: quando tinha default `false`, a tela que
   * esquecia de passá-la bloqueava o admin com uma mensagem enganosa, e o
   * esquecimento não aparecia em lugar nenhum. Sem default, o compilador
   * cobra.
   */
  isAdmin: boolean;
  onPagar?: (lancamento: Lancamento) => void;
  onEditar?: (lancamento: Lancamento) => void;
  onDeletar?: (lancamento: Lancamento) => void;
  onHistorico?: (lancamento: Lancamento) => void;
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function formatarData(data: string): string {
  try {
    return format(parseISO(data), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return data;
  }
}

const STATUS_CONFIG: Record<
  StatusLancamento,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pago: {
    label: "Pago",
    color: "text-sucesso bg-emerald-400/10",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  pendente: {
    label: "Pendente",
    color: "text-alerta bg-amber-400/10",
    icon: <Clock className="w-3 h-3" />,
  },
  atrasado: {
    label: "Atrasado",
    color: "text-erro bg-red-400/10",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  cancelado: {
    label: "Cancelado",
    color: "text-muted-foreground bg-slate-400/10",
    icon: <XCircle className="w-3 h-3" />,
  },
};

function StatusBadge({ status }: { status: StatusLancamento }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-superficie rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function LancamentoTable({
  lancamentos,
  loading,
  isAdmin,
  onPagar,
  onEditar,
  onDeletar,
  onHistorico,
}: LancamentoTableProps) {
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Vencimento</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!lancamentos.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-suave">
        <p className="text-sm">Nenhum lançamento encontrado.</p>
        <p className="text-xs mt-1">Crie o primeiro lançamento para começar.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Descrição
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Tipo
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Valor
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Vencimento
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lancamentos.map((lancamento) => (
            <tr
              key={lancamento.id}
              className="hover:bg-white/[0.02] transition-colors group"
            >
              {/* Descrição */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {lancamento.categoria_cor && (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: lancamento.categoria_cor }}
                    />
                  )}
                  <div>
                    <p className="font-medium text-foreground-suave truncate max-w-[200px] flex items-center gap-1.5">
                      {lancamento.descricao}
                      {lancamento.tipo === "emprestimo" && (
                        <span className="text-[0.625rem] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-alerta border border-amber-500/25 flex-shrink-0">
                          Empréstimo
                        </span>
                      )}
                    </p>
                    {lancamento.tipo === "emprestimo" && lancamento.pessoa_emprestimo ? (
                      <p className="text-xs text-muted-suave">
                        {lancamento.direcao_emprestimo === "peguei_emprestado"
                          ? "de "
                          : "para "}
                        {lancamento.pessoa_emprestimo}
                      </p>
                    ) : (
                      lancamento.categoria_nome && (
                        <p className="text-xs text-muted-suave">
                          {lancamento.categoria_nome}
                        </p>
                      )
                    )}
                  </div>
                </div>
              </td>

              {/* Tipo */}
              <td className="px-4 py-3">
                <span
                  className={`text-xs font-medium ${
                    lancamento.tipo === "receita"
                      ? "text-sucesso"
                      : lancamento.tipo === "emprestimo"
                        ? "text-alerta"
                        : "text-erro"
                  }`}
                >
                  {lancamento.tipo === "receita"
                    ? "Receita"
                    : lancamento.tipo === "emprestimo"
                      ? "Empréstimo"
                      : "Despesa"}
                </span>
              </td>

              {/* Valor */}
              <td className="px-4 py-3 text-right">
                <span
                  className={`font-semibold tabular-nums ${
                    lancamento.tipo === "receita"
                      ? "text-sucesso"
                      : lancamento.tipo === "emprestimo"
                        ? "text-alerta"
                        : "text-erro"
                  }`}
                >
                  {lancamento.tipo === "receita"
                    ? "+"
                    : lancamento.tipo === "emprestimo"
                      ? ""
                      : "-"}
                  {formatarMoeda(Number(lancamento.valor))}
                </span>
              </td>

              {/* Vencimento */}
              <td className="px-4 py-3 text-muted-foreground tabular-nums">
                {formatarData(lancamento.data_vencimento)}
              </td>

              {/* Status */}
              <td className="px-4 py-3">
                <StatusBadge status={lancamento.status} />
              </td>

              {/* Ações */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {(lancamento.status === "pendente" ||
                    lancamento.status === "atrasado") &&
                    onPagar && (
                      <button
                        onClick={() => onPagar(lancamento)}
                        className="p-1.5 rounded text-sucesso hover:bg-emerald-400/10 transition-colors"
                        title="Marcar como pago"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}

                  {/* Editar pago: fluxo auditado, restrito a admin.
                      Pendentes seguem o fluxo atual (sem edição na tabela). */}
                  {onEditar &&
                    lancamento.status === "pago" &&
                    (isAdmin ? (
                      <button
                        onClick={() => onEditar(lancamento)}
                        className="p-1.5 rounded text-brand-accent hover:bg-brand-400/10 transition-colors"
                        title="Editar pagamento (com auditoria)"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        disabled
                        aria-disabled="true"
                        className="p-1.5 rounded text-muted-foreground cursor-not-allowed"
                        title="Só administradores podem editar pagamentos"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    ))}

                  {/* Excluir: pago é fluxo auditado, restrito a admin */}
                  {onDeletar &&
                    (lancamento.status !== "pago" || isAdmin ? (
                      <button
                        onClick={() => onDeletar(lancamento)}
                        className="p-1.5 rounded text-erro hover:bg-red-400/10 transition-colors"
                        title={
                          lancamento.status === "pago"
                            ? "Excluir pagamento (com auditoria)"
                            : "Excluir lançamento"
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        disabled
                        aria-disabled="true"
                        className="p-1.5 rounded text-muted-foreground cursor-not-allowed"
                        title="Só administradores podem excluir pagamentos"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ))}

                  {onHistorico && (
                    <button
                      onClick={() => onHistorico(lancamento)}
                      className="p-1.5 rounded text-muted-foreground hover:bg-superficie-forte transition-colors"
                      title="Histórico de alterações"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

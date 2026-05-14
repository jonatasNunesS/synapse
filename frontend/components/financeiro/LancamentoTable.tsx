"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2,
  XCircle,
} from "lucide-react";
import type { Lancamento, StatusLancamento } from "@/types/financeiro";

interface LancamentoTableProps {
  lancamentos: Lancamento[];
  loading?: boolean;
  onPagar?: (lancamento: Lancamento) => void;
  onDeletar?: (lancamento: Lancamento) => void;
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
    color: "text-emerald-400 bg-emerald-400/10",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  pendente: {
    label: "Pendente",
    color: "text-amber-400 bg-amber-400/10",
    icon: <Clock className="w-3 h-3" />,
  },
  atrasado: {
    label: "Atrasado",
    color: "text-red-400 bg-red-400/10",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  cancelado: {
    label: "Cancelado",
    color: "text-slate-400 bg-slate-400/10",
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
    <tr className="border-b border-white/5">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-white/5 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function LancamentoTable({
  lancamentos,
  loading,
  onPagar,
  onDeletar,
}: LancamentoTableProps) {
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Descrição</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Valor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Vencimento</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
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
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <p className="text-sm">Nenhum lançamento encontrado.</p>
        <p className="text-xs mt-1">Crie o primeiro lançamento para começar.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Descrição
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Tipo
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
              Valor
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Vencimento
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
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
                    <p className="font-medium text-slate-200 truncate max-w-[200px]">
                      {lancamento.descricao}
                    </p>
                    {lancamento.categoria_nome && (
                      <p className="text-xs text-slate-500">
                        {lancamento.categoria_nome}
                      </p>
                    )}
                  </div>
                </div>
              </td>

              {/* Tipo */}
              <td className="px-4 py-3">
                <span
                  className={`text-xs font-medium ${
                    lancamento.tipo === "receita"
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {lancamento.tipo === "receita" ? "Receita" : "Despesa"}
                </span>
              </td>

              {/* Valor */}
              <td className="px-4 py-3 text-right">
                <span
                  className={`font-semibold tabular-nums ${
                    lancamento.tipo === "receita"
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {lancamento.tipo === "receita" ? "+" : "-"}
                  {formatarMoeda(Number(lancamento.valor))}
                </span>
              </td>

              {/* Vencimento */}
              <td className="px-4 py-3 text-slate-400 tabular-nums">
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
                        className="p-1.5 rounded text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                        title="Marcar como pago"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                  {onDeletar && (
                    <button
                      onClick={() => onDeletar(lancamento)}
                      className="p-1.5 rounded text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Excluir lançamento"
                    >
                      <Trash2 className="w-4 h-4" />
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

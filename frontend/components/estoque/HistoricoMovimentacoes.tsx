"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDown, ArrowUp, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import type { Movimentacao, TipoMovimentacao } from "@/types/estoque";

interface HistoricoMovimentacoesProps {
  movimentacoes: Movimentacao[];
  paginacao: { total: number; pagina: number; totalPaginas: number };
  loading?: boolean;
  onPaginaChange?: (pagina: number) => void;
}

const TIPO_CONFIG: Record<TipoMovimentacao, {
  label: string;
  icon: typeof ArrowDown;
  cor: string;
  bg: string;
}> = {
  entrada: {
    label: "Entrada",
    icon: ArrowDown,
    cor: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  saida: {
    label: "Saída",
    icon: ArrowUp,
    cor: "text-red-400",
    bg: "bg-red-500/10",
  },
  ajuste: {
    label: "Ajuste",
    icon: RefreshCw,
    cor: "text-blue-400",
    bg: "bg-blue-500/10",
  },
};

const MOTIVO_LABELS: Record<string, string> = {
  compra: "Compra",
  venda: "Venda",
  devolucao_compra: "Devolução de Compra",
  devolucao_venda: "Devolução de Venda",
  ajuste_manual: "Ajuste Manual",
  perda: "Perda / Avaria",
  transferencia: "Transferência",
  producao: "Produção",
  consumo_interno: "Consumo Interno",
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-white/5 animate-pulse">
      <div className="h-9 w-9 rounded-lg bg-white/10 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 bg-white/10 rounded" />
        <div className="h-3 w-48 bg-white/10 rounded" />
      </div>
      <div className="text-right space-y-2">
        <div className="h-4 w-16 bg-white/10 rounded" />
        <div className="h-3 w-20 bg-white/10 rounded" />
      </div>
    </div>
  );
}

export function HistoricoMovimentacoes({
  movimentacoes,
  paginacao,
  loading,
  onPaginaChange,
}: HistoricoMovimentacoesProps) {
  if (!loading && movimentacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <RefreshCw className="h-10 w-10 text-slate-600 mb-3" />
        <p className="text-slate-400 font-medium">Nenhuma movimentação registrada</p>
        <p className="text-sm text-slate-500 mt-1">
          As entradas e saídas aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y divide-white/5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          : movimentacoes.map((mov) => {
              const config = TIPO_CONFIG[mov.tipo];
              const Icon = config.icon;
              const delta =
                mov.tipo === "saida"
                  ? -Number(mov.quantidade)
                  : Number(mov.quantidade);

              return (
                <div
                  key={mov.id}
                  className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
                >
                  <div
                    className={`h-9 w-9 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className={`h-4 w-4 ${config.cor}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${config.cor}`}>
                        {config.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        · {MOTIVO_LABELS[mov.motivo] || mov.motivo}
                      </span>
                      {mov.referencia && (
                        <span className="text-xs text-slate-600 font-mono">
                          #{mov.referencia}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">
                        {mov.criado_por_nome || "Sistema"}
                      </span>
                      <span className="text-slate-700">·</span>
                      <span className="text-xs text-slate-500">
                        {format(new Date(mov.criado_em), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    {mov.observacoes && (
                      <p className="text-xs text-slate-600 mt-0.5 truncate">
                        {mov.observacoes}
                      </p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div
                      className={`text-sm font-bold ${
                        delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-blue-400"
                      }`}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta.toLocaleString("pt-BR")}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {Number(mov.estoque_antes).toLocaleString("pt-BR")} →{" "}
                      <span className="text-white">
                        {Number(mov.estoque_depois).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      {/* Paginação */}
      {paginacao.totalPaginas > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
          <p className="text-sm text-slate-400">
            {paginacao.total} movimentaç{paginacao.total !== 1 ? "ões" : "ão"}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPaginaChange?.(paginacao.pagina - 1)}
              disabled={paginacao.pagina <= 1}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-slate-400">
              {paginacao.pagina} / {paginacao.totalPaginas}
            </span>
            <button
              onClick={() => onPaginaChange?.(paginacao.pagina + 1)}
              disabled={paginacao.pagina >= paginacao.totalPaginas}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDown, ArrowUp, RefreshCw, ChevronLeft, ChevronRight, Undo2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Movimentacao, TipoMovimentacao } from "@/types/estoque";
import type { ApiError } from "@/types/api";

interface HistoricoMovimentacoesProps {
  movimentacoes: Movimentacao[];
  paginacao: { total: number; pagina: number; totalPaginas: number };
  loading?: boolean;
  onPaginaChange?: (pagina: number) => void;
  onEstornar?: () => void;
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
    cor: "text-sucesso",
    bg: "bg-emerald-500/10",
  },
  saida: {
    label: "Saída",
    icon: ArrowUp,
    cor: "text-erro",
    bg: "bg-red-500/10",
  },
  ajuste: {
    label: "Ajuste",
    icon: RefreshCw,
    cor: "text-info",
    bg: "bg-blue-500/10",
  },
};

const MOTIVO_LABELS: Record<string, string> = {
  compra: "Compra",
  venda: "Venda",
  devolucao: "Devolução / Estorno",
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
    <div className="flex items-center gap-4 p-4 border-b border-border animate-pulse">
      <div className="h-9 w-9 rounded-lg bg-superficie-forte flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 bg-superficie-forte rounded" />
        <div className="h-3 w-48 bg-superficie-forte rounded" />
      </div>
      <div className="text-right space-y-2">
        <div className="h-4 w-16 bg-superficie-forte rounded" />
        <div className="h-3 w-20 bg-superficie-forte rounded" />
      </div>
    </div>
  );
}

export function HistoricoMovimentacoes({
  movimentacoes,
  paginacao,
  loading,
  onPaginaChange,
  onEstornar,
}: HistoricoMovimentacoesProps) {
  const [confirmandoEstorno, setConfirmandoEstorno] = useState<string | null>(null);
  const [estornando, setEstornando] = useState(false);
  const [erroEstorno, setErroEstorno] = useState<string | null>(null);

  const handleEstornar = async (mov: Movimentacao) => {
    setEstornando(true);
    setErroEstorno(null);
    try {
      await api.post(`/estoque/movimentacoes/${mov.id}/estornar/`);
      setConfirmandoEstorno(null);
      onEstornar?.();
    } catch (err: unknown) {
      const e = err as ApiError;
      setErroEstorno(e?.error?.message ?? "Erro ao estornar movimentação.");
    } finally {
      setEstornando(false);
    }
  };
  if (!loading && movimentacoes.length === 0 && !erroEstorno) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <RefreshCw className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">Nenhuma movimentação registrada</p>
        <p className="text-sm text-muted-suave mt-1">
          As entradas e saídas aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div>
      {erroEstorno && (
        <div className="mx-4 mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-erro">
          {erroEstorno}
        </div>
      )}
      <div className="divide-y divide-border">
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
                  className="flex items-center gap-4 p-4 hover:bg-superficie transition-colors"
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
                      <span className="text-xs text-muted-suave">
                        · {MOTIVO_LABELS[mov.motivo] || mov.motivo}
                      </span>
                      {mov.referencia && (
                        <span className="text-xs text-muted-foreground font-mono">
                          #{mov.referencia}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-suave">
                        {mov.criado_por_nome || "Sistema"}
                      </span>
                      <span className="text-foreground-suave">·</span>
                      <span className="text-xs text-muted-suave">
                        {format(new Date(mov.criado_em), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    {mov.observacoes && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {mov.observacoes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div
                        className={`text-sm font-bold ${
                          delta > 0 ? "text-sucesso" : delta < 0 ? "text-erro" : "text-info"
                        }`}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta.toLocaleString("pt-BR")}
                      </div>
                      <div className="text-xs text-muted-suave mt-0.5">
                        {Number(mov.estoque_antes).toLocaleString("pt-BR")} →{" "}
                        <span className="text-foreground">
                          {Number(mov.estoque_depois).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </div>
                    {confirmandoEstorno === mov.id ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-muted-foreground">Confirmar estorno?</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEstornar(mov)}
                            disabled={estornando}
                            className="px-2 py-0.5 rounded text-xs bg-orange-500/20 text-alerta hover:bg-orange-500/30 transition-colors disabled:opacity-50"
                          >
                            {estornando ? "..." : "Sim"}
                          </button>
                          <button
                            onClick={() => setConfirmandoEstorno(null)}
                            className="px-2 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Não
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmandoEstorno(mov.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-alerta hover:bg-orange-500/10 transition-colors"
                        title={`Estornar — cria movimentação inversa de ${Math.abs(delta)} unidades`}
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
      </div>

      {/* Paginação */}
      {paginacao.totalPaginas > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {paginacao.total} movimentaç{paginacao.total !== 1 ? "ões" : "ão"}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPaginaChange?.(paginacao.pagina - 1)}
              disabled={paginacao.pagina <= 1}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-superficie-forte disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-muted-foreground">
              {paginacao.pagina} / {paginacao.totalPaginas}
            </span>
            <button
              onClick={() => onPaginaChange?.(paginacao.pagina + 1)}
              disabled={paginacao.pagina >= paginacao.totalPaginas}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-superficie-forte disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

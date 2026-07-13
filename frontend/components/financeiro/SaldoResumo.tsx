"use client";
/**
 * KPIs do Financeiro: dois saldos em destaque + quatro métricas do mês.
 *
 * - Saldo ACUMULADO ignora o filtro de mês (dinheiro real hoje).
 * - Saldo DO MÊS respeita o filtro (resultado do período).
 * - Saldos coloridos por sinal (verde positivo / vermelho negativo).
 * - Cards coloridos por tipo (receita = verde suave, despesa = vermelho suave)
 *   e clicáveis: filtram a lista abaixo por aquele tipo+status.
 */
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  Wallet,
  CalendarDays,
} from "lucide-react";
import type { SaldoFinanceiro } from "@/types/financeiro";

const MESES = [
  "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function moeda(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v);
}

function corSaldo(v: number): string {
  return v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-slate-200";
}

function sinal(v: number): string {
  return v > 0 ? "+" : "";
}

// tipo+status que cada card representa (para filtrar a lista)
export type FiltroMetrica = { tipo: "receita" | "despesa"; status: "pago" | "pendente" };

interface MetricaDef {
  key: string;
  titulo: string;
  metrica: { total: number; count: number };
  filtro: FiltroMetrica;
  icon: React.ReactNode;
  ring: string;
  chip: string;
}

interface SaldoResumoProps {
  saldo: SaldoFinanceiro | null;
  loading?: boolean;
  filtroAtivo?: FiltroMetrica | null;
  onFiltrar?: (f: FiltroMetrica | null) => void;
}

function SkeletonLinha() {
  return <div className="h-7 w-32 bg-white/10 rounded animate-pulse" />;
}

export function SaldoResumo({ saldo, loading, filtroAtivo, onFiltrar }: SaldoResumoProps) {
  const ac = saldo?.acumulado;
  const m = saldo?.mes_atual;
  const nomeMes = m ? MESES[m.mes] : "";

  const metricas: MetricaDef[] = [
    {
      key: "recebido",
      titulo: "Recebido",
      metrica: m?.recebido ?? { total: 0, count: 0 },
      filtro: { tipo: "receita", status: "pago" },
      icon: <ArrowUpCircle className="h-4 w-4 text-emerald-400" />,
      ring: "hover:border-emerald-500/40",
      chip: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      key: "a_receber",
      titulo: "A receber",
      metrica: m?.a_receber ?? { total: 0, count: 0 },
      filtro: { tipo: "receita", status: "pendente" },
      icon: <Clock className="h-4 w-4 text-emerald-300" />,
      ring: "hover:border-emerald-500/40",
      chip: "bg-emerald-500/[0.06] border-emerald-500/15",
    },
    {
      key: "pago",
      titulo: "Pago",
      metrica: m?.pago ?? { total: 0, count: 0 },
      filtro: { tipo: "despesa", status: "pago" },
      icon: <ArrowDownCircle className="h-4 w-4 text-red-400" />,
      ring: "hover:border-red-500/40",
      chip: "bg-red-500/10 border-red-500/20",
    },
    {
      key: "a_pagar",
      titulo: "A pagar",
      metrica: m?.a_pagar ?? { total: 0, count: 0 },
      filtro: { tipo: "despesa", status: "pendente" },
      icon: <Clock className="h-4 w-4 text-red-300" />,
      ring: "hover:border-red-500/40",
      chip: "bg-red-500/[0.06] border-red-500/15",
    },
  ];

  const isAtivo = (f: FiltroMetrica) =>
    filtroAtivo?.tipo === f.tipo && filtroAtivo?.status === f.status;

  return (
    <div className="space-y-4">
      {/* Dois saldos em destaque */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-slate-400" />
            <p className="text-sm text-slate-400">Saldo acumulado</p>
          </div>
          {loading ? (
            <SkeletonLinha />
          ) : (
            <p className={`text-3xl font-bold tabular-nums ${corSaldo(ac?.saldo ?? 0)}`}>
              {moeda(ac?.saldo ?? 0)}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            Dinheiro real disponível hoje (todo o histórico)
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <p className="text-sm text-slate-400 capitalize">
              Saldo do mês{nomeMes ? ` (${nomeMes})` : ""}
            </p>
          </div>
          {loading ? (
            <SkeletonLinha />
          ) : (
            <p className={`text-3xl font-bold tabular-nums ${corSaldo(m?.saldo ?? 0)}`}>
              {sinal(m?.saldo ?? 0)}
              {moeda(m?.saldo ?? 0)}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            Resultado do período (recebido − pago)
          </p>
        </div>
      </div>

      {/* Quatro métricas do mês */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metricas.map((mt) => {
          const ativo = isAtivo(mt.filtro);
          const clicavel = !!onFiltrar;
          return (
            <button
              key={mt.key}
              type="button"
              disabled={!clicavel}
              onClick={() => onFiltrar?.(ativo ? null : mt.filtro)}
              aria-pressed={ativo}
              className={`text-left rounded-xl border p-4 transition-colors ${mt.chip} ${
                clicavel ? `cursor-pointer ${mt.ring}` : "cursor-default"
              } ${ativo ? "ring-2 ring-white/30" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400">{mt.titulo}</p>
                {mt.icon}
              </div>
              {loading ? (
                <div className="h-6 w-20 bg-white/10 rounded animate-pulse" />
              ) : (
                <p className="text-lg font-bold text-white tabular-nums">
                  {moeda(mt.metrica.total)}
                </p>
              )}
              <p className="text-[11px] text-slate-500 mt-0.5">
                {mt.metrica.count} lançamento{mt.metrica.count !== 1 ? "s" : ""}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

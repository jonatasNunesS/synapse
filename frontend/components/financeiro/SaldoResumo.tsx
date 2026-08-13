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
import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  HandCoins,
  PiggyBank,
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
  return v > 0 ? "text-sucesso" : v < 0 ? "text-erro" : "text-foreground-suave";
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
  return <div className="h-7 w-32 bg-superficie-forte rounded animate-pulse" />;
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
      icon: <ArrowUpCircle className="h-4 w-4 text-sucesso" />,
      ring: "hover:border-emerald-500/40",
      chip: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      key: "a_receber",
      titulo: "A receber",
      metrica: m?.a_receber ?? { total: 0, count: 0 },
      filtro: { tipo: "receita", status: "pendente" },
      icon: <Clock className="h-4 w-4 text-sucesso" />,
      ring: "hover:border-emerald-500/40",
      chip: "bg-emerald-500/[0.06] border-emerald-500/15",
    },
    {
      key: "pago",
      titulo: "Pago",
      metrica: m?.pago ?? { total: 0, count: 0 },
      filtro: { tipo: "despesa", status: "pago" },
      icon: <ArrowDownCircle className="h-4 w-4 text-erro" />,
      ring: "hover:border-red-500/40",
      chip: "bg-red-500/10 border-red-500/20",
    },
    {
      key: "a_pagar",
      titulo: "A pagar",
      metrica: m?.a_pagar ?? { total: 0, count: 0 },
      filtro: { tipo: "despesa", status: "pendente" },
      icon: <Clock className="h-4 w-4 text-erro" />,
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
        {(() => {
          // Caixinhas e empréstimos convivem sob o saldo disponível:
          //   Saldo disponível: R$ X
          //     └ Em caixinhas: R$ Y · Emprestado: R$ Z · A devolver: R$ W
          //   Patrimônio total: R$ (só quando há caixinhas — é o que difere)
          // Sem caixinhas nem empréstimos: comportamento original (acumulado).
          const emp = saldo?.emprestimos;
          const temCaixinhas = (saldo?.caixinhas?.quantidade ?? 0) > 0;
          const temEmprestimos = (emp?.quantidade ?? 0) > 0;
          const temExtra = temCaixinhas || temEmprestimos;
          const disponivel = saldo?.saldo_disponivel ?? ac?.saldo ?? 0;
          return (
            <div className="rounded-xl border border-border bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {temExtra ? "Saldo disponível" : "Saldo acumulado"}
                </p>
              </div>
              {loading ? (
                <SkeletonLinha />
              ) : (
                <p className={`text-3xl font-bold tabular-nums ${corSaldo(temExtra ? disponivel : ac?.saldo ?? 0)}`}>
                  {moeda(temExtra ? disponivel : ac?.saldo ?? 0)}
                </p>
              )}
              {temExtra ? (
                <div className="text-xs mt-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {temCaixinhas && (
                      <Link
                        href="/financeiro/caixinhas"
                        className="inline-flex items-center gap-1 text-brand-accent hover:text-brand-accent transition-colors"
                      >
                        <PiggyBank className="h-3.5 w-3.5" />
                        Em caixinhas: {moeda(saldo?.caixinhas?.total ?? 0)}
                      </Link>
                    )}
                    {temCaixinhas && temEmprestimos && (
                      <span aria-hidden className="text-slate-600">·</span>
                    )}
                    {temEmprestimos && (
                      <Link
                        href="/financeiro/emprestimos"
                        className="inline-flex flex-wrap items-center gap-x-1.5 text-alerta/90 hover:text-alerta transition-colors"
                      >
                        <HandCoins className="h-3.5 w-3.5" />
                        {(emp?.a_receber ?? 0) > 0 && (
                          <span>Emprestado: {moeda(emp!.a_receber)}</span>
                        )}
                        {(emp?.a_receber ?? 0) > 0 && (emp?.a_devolver ?? 0) > 0 && (
                          <span aria-hidden>·</span>
                        )}
                        {(emp?.a_devolver ?? 0) > 0 && (
                          <span>A devolver: {moeda(emp!.a_devolver)}</span>
                        )}
                      </Link>
                    )}
                  </div>
                  {temCaixinhas && (
                    <p className="text-muted-suave">
                      Patrimônio total: {moeda(saldo?.patrimonio_total ?? 0)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-suave mt-1">
                  Dinheiro real disponível hoje (todo o histórico)
                </p>
              )}
            </div>
          );
        })()}

        <div className="rounded-xl border border-border bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground capitalize">
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
          <p className="text-xs text-muted-suave mt-1">
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
                <p className="text-xs text-muted-foreground">{mt.titulo}</p>
                {mt.icon}
              </div>
              {loading ? (
                <div className="h-6 w-20 bg-superficie-forte rounded animate-pulse" />
              ) : (
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {moeda(mt.metrica.total)}
                </p>
              )}
              <p className="text-[0.6875rem] text-muted-suave mt-0.5">
                {mt.metrica.count} lançamento{mt.metrica.count !== 1 ? "s" : ""}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

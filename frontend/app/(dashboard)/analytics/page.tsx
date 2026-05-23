"use client";

/**
 * Synapse — M8: Página de Analytics
 * Gráficos avançados com seleção de período.
 */

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodoSelector } from "@/components/dashboard/PeriodoSelector";
import { useAnalytics } from "@/hooks/useDashboard";
import type { PeriodoAnalytics } from "@/types/dashboard";
import { STATUS_FUNIL_LABELS, STATUS_FUNIL_CORES } from "@/types/dashboard";

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact" });

const formatCurrencyFull = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (dateStr: string) => {
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
};

const CustomTooltipFinanceiro = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm min-w-[180px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }} className="flex justify-between gap-4">
          <span className="capitalize">{entry.name === "receitas" ? "Receitas" : entry.name === "despesas" ? "Despesas" : "Saldo Acum."}:</span>
          <span className="font-medium">{formatCurrencyFull(entry.value)}</span>
        </p>
      ))}
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════

export default function AnalyticsPage() {
  const { periodo, setPeriodo, fluxoCaixa, funil, resumo } = useAnalytics();

  const fluxoDados = fluxoCaixa.fluxo.map((d) => ({
    ...d,
    data: formatDate(d.data),
  }));

  const funilDados = funil.etapas.map((e) => ({
    ...e,
    label: STATUS_FUNIL_LABELS[e.status] ?? e.status,
    cor: STATUS_FUNIL_CORES[e.status] ?? "#6b7280",
  }));

  // Dados de receitas vs despesas por semana (agrupados do fluxo)
  const receitasDespesasAgrupadas = (() => {
    const grupos: Record<string, { semana: string; receitas: number; despesas: number }> = {};
    fluxoCaixa.fluxo.forEach((d) => {
      const date = new Date(d.data);
      const semanaNum = Math.ceil(date.getDate() / 7);
      const chave = `S${semanaNum}/${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!grupos[chave]) grupos[chave] = { semana: chave, receitas: 0, despesas: 0 };
      grupos[chave].receitas += d.receitas;
      grupos[chave].despesas += d.despesas;
    });
    return Object.values(grupos);
  })();

  // Dados de distribuição por tipo de lançamento (pie chart)
  const distribuicaoFinanceira = resumo.resumo
    ? [
        {
          name: "Receitas",
          value: resumo.resumo.financeiro.total_receitas,
          cor: "#22c55e",
        },
        {
          name: "Despesas",
          value: resumo.resumo.financeiro.total_despesas,
          cor: "#ef4444",
        },
        {
          name: "A Receber",
          value: resumo.resumo.financeiro.total_pendente,
          cor: "#f59e0b",
        },
      ]
    : [];

  const isLoading = fluxoCaixa.isLoading || funil.isLoading || resumo.isLoading;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* ── Cabeçalho ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Análise detalhada do desempenho do negócio
            </p>
          </div>
        </div>
        <PeriodoSelector
          value={periodo}
          onChange={(p: PeriodoAnalytics) => setPeriodo(p)}
        />
      </div>

      {/* ── KPIs de Resumo ─────────────────────────────────── */}
      {resumo.resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Receitas",
              valor: formatCurrencyFull(resumo.resumo.financeiro.total_receitas),
              cor: "text-green-600",
              bg: "bg-green-50",
            },
            {
              label: "Despesas",
              valor: formatCurrencyFull(resumo.resumo.financeiro.total_despesas),
              cor: "text-red-600",
              bg: "bg-red-50",
            },
            {
              label: "Saldo",
              valor: formatCurrencyFull(resumo.resumo.financeiro.saldo_mes),
              cor: resumo.resumo.financeiro.saldo_mes >= 0 ? "text-green-600" : "text-red-600",
              bg: resumo.resumo.financeiro.saldo_mes >= 0 ? "bg-green-50" : "bg-red-50",
            },
            {
              label: "Clientes",
              valor: resumo.resumo.crm.total_clientes.toString(),
              cor: "text-purple-600",
              bg: "bg-purple-50",
            },
          ].map((kpi) => (
            <Card key={kpi.label} className={`${kpi.bg} border-0`}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                <p className={`text-lg font-bold mt-1 ${kpi.cor}`}>{kpi.valor}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Fluxo de Caixa Detalhado ───────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Fluxo de Caixa — Últimos {fluxoCaixa.dias} dias
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full rounded-lg" />
          ) : fluxoDados.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível para o período selecionado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={fluxoDados} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradReceitas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDespesas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={75} />
                <Tooltip content={<CustomTooltipFinanceiro />} />
                <Legend
                  formatter={(value: string) => {
                    if (value === "receitas") return "Receitas";
                    if (value === "despesas") return "Despesas";
                    return "Saldo Acum.";
                  }}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12 }}
                />

                <Area type="monotone" dataKey="receitas" stroke="#22c55e" strokeWidth={2} fill="url(#gradReceitas)" />
                <Area type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} fill="url(#gradDespesas)" />
                <Area type="monotone" dataKey="saldo_acumulado" name="saldo" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 2" fill="url(#gradSaldo)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Linha: Receitas vs Despesas por Semana + Funil ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Receitas vs Despesas por Semana */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Receitas vs Despesas por Semana</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[260px] w-full rounded-lg" />
            ) : receitasDespesasAgrupadas.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={receitasDespesasAgrupadas} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="semana" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrencyFull(Number(value ?? 0)),
                      name === "receitas" ? "Receitas" : "Despesas",
                    ]}
                  />

                  <Legend
                    formatter={(v: string) =>
                      v === "receitas" ? "Receitas" : v === "despesas" ? "Despesas" : "Saldo Acum."
                    }
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>

              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Funil de Vendas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição do Funil de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            {funil.isLoading ? (
              <Skeleton className="h-[260px] w-full rounded-lg" />
            ) : funilDados.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum cliente cadastrado.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={funilDados}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="count"
                    >
                      {funilDados.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        `${value} cliente${value !== 1 ? "s" : ""}`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legenda */}
                <div className="flex flex-col gap-2 min-w-[140px]">
                  {funilDados.map((e) => (
                    <div key={e.status} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: e.cor }} />
                      <span className="text-xs text-muted-foreground">{e.label}</span>
                      <span className="text-xs font-semibold ml-auto">{e.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Distribuição Financeira (Pie) + Linha de Saldo ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribuição Financeira */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição Financeira do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            {resumo.isLoading ? (
              <Skeleton className="h-[240px] w-full rounded-lg" />
            ) : distribuicaoFinanceira.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado financeiro disponível.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={distribuicaoFinanceira}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {distribuicaoFinanceira.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        formatCurrencyFull(Number(value ?? 0)),
                        name ?? "",
                      ]}
                    />

                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 min-w-[160px]">
                  {distribuicaoFinanceira.map((e) => (
                    <div key={e.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: e.cor }} />
                      <span className="text-xs text-muted-foreground">{e.name}</span>
                      <span className="text-xs font-semibold ml-auto">{formatCurrency(e.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evolução do Saldo Acumulado */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução do Saldo Acumulado</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[240px] w-full rounded-lg" />
            ) : fluxoDados.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={fluxoDados} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="data" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={75} />
                  <Tooltip
                    formatter={(value) => [formatCurrencyFull(Number(value ?? 0)), "Saldo Acumulado"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="saldo_acumulado"
                    name="Saldo Acumulado"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

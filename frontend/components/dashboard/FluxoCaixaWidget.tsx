"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FluxoCaixaDia } from "@/types/dashboard";

interface FluxoCaixaWidgetProps {
  fluxo: FluxoCaixaDia[];
  isLoading: boolean;
  titulo?: string;
}

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact" });

const formatDate = (dateStr: string) => {
  const [, mes, dia] = dateStr.split("-");
  return `${dia}/${mes}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }} className="flex justify-between gap-4">
          <span>{entry.name}:</span>
          <span className="font-medium">
            {entry.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </p>
      ))}
    </div>
  );
};

export function FluxoCaixaWidget({ fluxo, isLoading, titulo = "Fluxo de Caixa" }: FluxoCaixaWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[220px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const dados = fluxo.map((d) => ({
    ...d,
    data: formatDate(d.data),
  }));

  if (dados.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{titulo}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado de fluxo de caixa disponível.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={dados} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="data"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) =>
                value === "receitas" ? "Receitas" : value === "despesas" ? "Despesas" : "Saldo"
              }
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="receitas"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#colorReceitas)"
            />
            <Area
              type="monotone"
              dataKey="despesas"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#colorDespesas)"
            />
            <Area
              type="monotone"
              dataKey="saldo_acumulado"
              name="saldo"
              stroke="#6366f1"
              strokeWidth={2}
              strokeDasharray="4 2"
              fill="url(#colorSaldo)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

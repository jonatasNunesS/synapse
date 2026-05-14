"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FluxoCaixaDia } from "@/types/financeiro";

interface FluxoCaixaChartProps {
  dados: FluxoCaixaDia[];
  loading?: boolean;
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

interface TooltipPayload {
  color: string;
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-[#1a1f2e] border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-xs text-slate-400 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-300">{entry.name}:</span>
          <span className="font-semibold text-white">
            {formatarMoeda(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function FluxoCaixaChart({ dados, loading }: FluxoCaixaChartProps) {
  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!dados.length) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-500">
        <p className="text-sm">Nenhum lançamento pago no período.</p>
      </div>
    );
  }

  const dadosFormatados = dados.map((d) => ({
    ...d,
    dataFormatada: format(parseISO(d.data), "dd/MM", { locale: ptBR }),
    receitas: Number(d.receitas),
    despesas: Number(d.despesas),
    saldo: Number(d.saldo),
  }));

  return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart
        data={dadosFormatados}
        margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
        barCategoryGap="30%"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.06)"
          vertical={false}
        />
        <XAxis
          dataKey="dataFormatada"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatarMoeda(v)}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#94a3b8", paddingTop: 8 }}
        />
        <Bar
          dataKey="receitas"
          name="Receitas"
          fill="#16a34a"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
        <Bar
          dataKey="despesas"
          name="Despesas"
          fill="#dc2626"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

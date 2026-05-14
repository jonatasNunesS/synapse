"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useDRE } from "@/hooks/useFinanceiro";
import type { DRECategoria } from "@/types/financeiro";

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function formatarPorcentagem(valor: number): string {
  return `${valor.toFixed(1)}%`;
}

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: DRECategoria }>;
}

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-[#1a1f2e] border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-sm font-medium text-white">{item.name}</p>
      <p className="text-sm text-slate-300">{formatarMoeda(item.value)}</p>
    </div>
  );
}

interface CategoriaRowProps {
  item: DRECategoria;
  total: number;
  tipo: "receita" | "despesa";
}

function CategoriaRow({ item, total, tipo }: CategoriaRowProps) {
  const pct = total > 0 ? (item.total / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: item.cor || (tipo === "receita" ? "#16a34a" : "#dc2626") }}
      />
      <span className="flex-1 text-sm text-slate-300 truncate">{item.categoria}</span>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex w-24 bg-white/5 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: item.cor || (tipo === "receita" ? "#16a34a" : "#dc2626"),
            }}
          />
        </div>
        <span className="text-xs text-slate-500 w-12 text-right tabular-nums">
          {formatarPorcentagem(pct)}
        </span>
        <span
          className={`text-sm font-semibold tabular-nums w-28 text-right ${
            tipo === "receita" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {formatarMoeda(item.total)}
        </span>
      </div>
    </div>
  );
}

export default function DREPage() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

  const { dre, loading } = useDRE(mes, ano);

  const mesPorExtenso = format(new Date(ano, mes - 1, 1), "MMMM yyyy", {
    locale: ptBR,
  });

  const navegarMes = (direcao: -1 | 1) => {
    const novaData = new Date(ano, mes - 1 + direcao, 1);
    setMes(novaData.getMonth() + 1);
    setAno(novaData.getFullYear());
  };

  const pieReceitas = (dre?.receitas_por_categoria ?? []).map((c) => ({
    ...c,
    name: c.categoria,
    value: c.total,
  }));

  const pieDespesas = (dre?.despesas_por_categoria ?? []).map((c) => ({
    ...c,
    name: c.categoria,
    value: c.total,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            DRE — Demonstrativo de Resultado
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Análise de receitas e despesas por categoria
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          <button
            onClick={() => navegarMes(-1)}
            className="p-1 rounded hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-white capitalize min-w-[120px] text-center">
            {mesPorExtenso}
          </span>
          <button
            onClick={() => navegarMes(1)}
            className="p-1 rounded hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Resultado resumido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <p className="text-sm text-slate-400">Total Receitas</p>
          </div>
          {loading ? (
            <div className="h-7 w-32 bg-white/10 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">
              {formatarMoeda(dre?.total_receitas ?? 0)}
            </p>
          )}
        </div>

        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <p className="text-sm text-slate-400">Total Despesas</p>
          </div>
          {loading ? (
            <div className="h-7 w-32 bg-white/10 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-red-400 tabular-nums">
              {formatarMoeda(dre?.total_despesas ?? 0)}
            </p>
          )}
        </div>

        <div
          className={`border rounded-xl p-5 ${
            (dre?.lucro_bruto ?? 0) >= 0
              ? "bg-violet-500/10 border-violet-500/20"
              : "bg-red-500/10 border-red-500/20"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-400">Resultado Líquido</p>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                (dre?.lucro_bruto ?? 0) >= 0
                  ? "bg-violet-500/20 text-violet-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              Margem: {formatarPorcentagem(dre?.margem ?? 0)}
            </span>
          </div>
          {loading ? (
            <div className="h-7 w-32 bg-white/10 rounded animate-pulse" />
          ) : (
            <p
              className={`text-2xl font-bold tabular-nums ${
                (dre?.lucro_bruto ?? 0) >= 0 ? "text-violet-400" : "text-red-400"
              }`}
            >
              {formatarMoeda(dre?.lucro_bruto ?? 0)}
            </p>
          )}
        </div>
      </div>

      {/* Detalhamento por categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receitas */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
          <h2 className="text-base font-semibold text-white mb-4">
            Receitas por Categoria
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          ) : !dre?.receitas_por_categoria.length ? (
            <p className="text-sm text-slate-500 py-4">
              Nenhuma receita no período.
            </p>
          ) : (
            <div className="space-y-1">
              {dre.receitas_por_categoria.map((cat) => (
                <CategoriaRow
                  key={cat.categoria_id ?? cat.categoria}
                  item={cat}
                  total={dre.total_receitas}
                  tipo="receita"
                />
              ))}
              <div className="flex justify-between pt-3 mt-1 border-t border-white/10">
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-sm font-bold text-emerald-400 tabular-nums">
                  {formatarMoeda(dre.total_receitas)}
                </span>
              </div>
            </div>
          )}

          {/* Gráfico pizza */}
          {pieReceitas.length > 0 && (
            <div className="mt-4 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieReceitas}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieReceitas.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.cor || "#16a34a"}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Despesas */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
          <h2 className="text-base font-semibold text-white mb-4">
            Despesas por Categoria
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          ) : !dre?.despesas_por_categoria.length ? (
            <p className="text-sm text-slate-500 py-4">
              Nenhuma despesa no período.
            </p>
          ) : (
            <div className="space-y-1">
              {dre.despesas_por_categoria.map((cat) => (
                <CategoriaRow
                  key={cat.categoria_id ?? cat.categoria}
                  item={cat}
                  total={dre.total_despesas}
                  tipo="despesa"
                />
              ))}
              <div className="flex justify-between pt-3 mt-1 border-t border-white/10">
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-sm font-bold text-red-400 tabular-nums">
                  {formatarMoeda(dre.total_despesas)}
                </span>
              </div>
            </div>
          )}

          {/* Gráfico pizza */}
          {pieDespesas.length > 0 && (
            <div className="mt-4 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieDespesas}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieDespesas.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.cor || "#dc2626"}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

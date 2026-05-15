"use client";

import { Package, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import type { ResumoEstoque } from "@/types/estoque";

interface ResumoCardsProps {
  resumo: ResumoEstoque | null;
  loading?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function SkeletonCard() {
  return (
    <div className="bg-[#0d1117] border border-white/10 rounded-xl p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-24 bg-white/10 rounded" />
        <div className="h-9 w-9 bg-white/10 rounded-lg" />
      </div>
      <div className="h-8 w-20 bg-white/10 rounded mb-1" />
      <div className="h-3 w-32 bg-white/10 rounded" />
    </div>
  );
}

export function ResumoCards({ resumo, loading }: ResumoCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const cards = [
    {
      titulo: "Total de Produtos",
      valor: resumo?.total_produtos ?? 0,
      subtitulo: `${resumo?.total_skus ?? 0} SKUs cadastrados`,
      icone: Package,
      cor: "text-blue-400",
      bg: "bg-blue-500/10",
      formato: "numero",
    },
    {
      titulo: "Valor em Estoque",
      valor: resumo?.valor_total_estoque ?? 0,
      subtitulo: "Custo total do inventário",
      icone: DollarSign,
      cor: "text-emerald-400",
      bg: "bg-emerald-500/10",
      formato: "moeda",
    },
    {
      titulo: "Abaixo do Mínimo",
      valor: resumo?.produtos_abaixo_minimo ?? 0,
      subtitulo: "Produtos que precisam de reposição",
      icone: AlertTriangle,
      cor:
        (resumo?.produtos_abaixo_minimo ?? 0) > 0
          ? "text-amber-400"
          : "text-slate-400",
      bg:
        (resumo?.produtos_abaixo_minimo ?? 0) > 0
          ? "bg-amber-500/10"
          : "bg-white/5",
      formato: "numero",
    },
    {
      titulo: "Sem Estoque",
      valor: resumo?.produtos_sem_estoque ?? 0,
      subtitulo: "Produtos zerados",
      icone: TrendingUp,
      cor:
        (resumo?.produtos_sem_estoque ?? 0) > 0
          ? "text-red-400"
          : "text-slate-400",
      bg:
        (resumo?.produtos_sem_estoque ?? 0) > 0
          ? "bg-red-500/10"
          : "bg-white/5",
      formato: "numero",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icone;
        return (
          <div
            key={card.titulo}
            className="bg-[#0d1117] border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">{card.titulo}</span>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <Icon className={`h-5 w-5 ${card.cor}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {card.formato === "moeda"
                ? formatCurrency(card.valor as number)
                : card.valor.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-slate-500">{card.subtitulo}</p>
          </div>
        );
      })}
    </div>
  );
}

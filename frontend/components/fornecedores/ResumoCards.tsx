"use client";

import { useEffect } from "react";
import { Building2, CheckCircle2, DollarSign, TrendingUp } from "lucide-react";
import { useResumoFornecedores } from "@/hooks/useFornecedores";

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

interface CardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}

function KpiCard({ title, value, subtitle, icon, color, loading }: CardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-zinc-400">{title}</p>
          {loading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded-md bg-white/10" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          )}
          {subtitle && (
            <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
          )}
        </div>
        <div className={`rounded-lg p-2.5 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

export function ResumoCards() {
  const { data, loading, fetch } = useResumoFornecedores();

  useEffect(() => {
    fetch();
  }, [fetch]);

  const taxaAtivos =
    data && data.total_fornecedores > 0
      ? Math.round((data.fornecedores_ativos / data.total_fornecedores) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Total de Fornecedores"
        value={loading ? "—" : data?.total_fornecedores ?? 0}
        subtitle={
          data
            ? `${taxaAtivos}% ativos`
            : undefined
        }
        icon={<Building2 className="h-5 w-5 text-blue-400" />}
        color="bg-blue-500/10"
        loading={loading}
      />
      <KpiCard
        title="Fornecedores Ativos"
        value={loading ? "—" : data?.fornecedores_ativos ?? 0}
        subtitle="em operação"
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
        color="bg-emerald-500/10"
        loading={loading}
      />
      <KpiCard
        title="Total Gasto"
        value={loading ? "—" : formatCurrency(data?.valor_total_gasto ?? "0")}
        subtitle="em compras registradas"
        icon={<DollarSign className="h-5 w-5 text-violet-400" />}
        color="bg-violet-500/10"
        loading={loading}
      />
      <KpiCard
        title="Ticket Médio"
        value={loading ? "—" : formatCurrency(data?.ticket_medio_geral ?? "0")}
        subtitle={
          data?.melhor_score
            ? `Top: ${data.melhor_score.nome}`
            : "por compra"
        }
        icon={<TrendingUp className="h-5 w-5 text-amber-400" />}
        color="bg-amber-500/10"
        loading={loading}
      />
    </div>
  );
}

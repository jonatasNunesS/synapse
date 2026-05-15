"use client";

import { Users, TrendingUp, DollarSign, Calendar, AlertCircle, UserPlus } from "lucide-react";
import type { ResumoClientes } from "@/types/clientes";

interface ResumoCardsProps {
  resumo: ResumoClientes | null;
  loading?: boolean;
}

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num || 0);
}

function Card({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  loading,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-[#0f1117] border border-white/10 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color} bg-opacity-15`}>
        <Icon className={`w-5 h-5 ${color.replace("bg-", "text-")}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{title}</p>
        {loading ? (
          <div className="h-7 w-20 bg-white/5 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        )}
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export function ResumoCards({ resumo, loading }: ResumoCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <Card
        title="Total de Clientes"
        value={resumo?.total_clientes ?? 0}
        subtitle={`${resumo?.clientes_ativos ?? 0} ativos`}
        icon={Users}
        color="bg-blue-500"
        loading={loading}
      />
      <Card
        title="Novos este Mês"
        value={resumo?.novos_este_mes ?? 0}
        icon={UserPlus}
        color="bg-purple-500"
        loading={loading}
      />
      <Card
        title="Receita Total"
        value={formatCurrency(resumo?.valor_total_vendas ?? "0")}
        icon={DollarSign}
        color="bg-green-500"
        loading={loading}
      />
      <Card
        title="Ticket Médio"
        value={formatCurrency(resumo?.ticket_medio ?? "0")}
        icon={TrendingUp}
        color="bg-cyan-500"
        loading={loading}
      />
      <Card
        title="Follow-ups Hoje"
        value={resumo?.followups_hoje ?? 0}
        icon={Calendar}
        color="bg-yellow-500"
        loading={loading}
      />
      <Card
        title="Follow-ups Atrasados"
        value={resumo?.followups_atrasados ?? 0}
        icon={AlertCircle}
        color="bg-red-500"
        loading={loading}
      />
    </div>
  );
}

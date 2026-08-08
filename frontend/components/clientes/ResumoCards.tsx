"use client";

import { Users, TrendingUp, DollarSign, Calendar, AlertCircle, UserPlus } from "lucide-react";
import type { ResumoClientes } from "@/types/clientes";

interface ResumoCardsProps {
  resumo: ResumoClientes | null;
  loading?: boolean;
  /** Há filtro de período (Mês/Ano) ativo? Ativa os KPIs do período. */
  periodoAtivo?: boolean;
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

export function ResumoCards({ resumo, loading, periodoAtivo }: ResumoCardsProps) {
  // Só mostra os KPIs do período quando o filtro está ativo E o backend devolveu
  // os campos do período (evita "flash" com dados do mês corrente).
  const emPeriodo = !!periodoAtivo && !!resumo?.periodo;
  const diff = resumo?.comparativo?.novos_diff ?? 0;
  const comparativoTxt = resumo?.comparativo
    ? `${diff >= 0 ? "+" : ""}${diff} novos vs ${resumo.comparativo.mes_anterior_label}`
    : "";

  return (
    <div className="space-y-3">
      {emPeriodo && (
        <div className="flex items-center justify-between flex-wrap gap-2 rounded-lg border border-brand-500/20 bg-brand-500/5 px-4 py-2.5">
          <span className="text-sm text-brand-300 font-medium capitalize">
            {resumo!.periodo!.label}
          </span>
          {comparativoTxt && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                diff > 0
                  ? "bg-emerald-500/15 text-emerald-400"
                  : diff < 0
                  ? "bg-red-500/15 text-red-400"
                  : "bg-white/10 text-gray-300"
              }`}
            >
              {comparativoTxt}
            </span>
          )}
        </div>
      )}

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
          title={emPeriodo ? "Novos no Período" : "Novos este Mês"}
          value={emPeriodo ? resumo?.novos_no_periodo ?? 0 : resumo?.novos_este_mes ?? 0}
          subtitle={emPeriodo ? comparativoTxt : undefined}
          icon={UserPlus}
          color="bg-brand-500"
          loading={loading}
        />
        <Card
          title={emPeriodo ? "Receita no Período" : "Receita Total"}
          value={formatCurrency(
            emPeriodo
              ? resumo?.valor_gerado_no_periodo ?? "0"
              : resumo?.valor_total_vendas ?? "0"
          )}
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
    </div>
  );
}

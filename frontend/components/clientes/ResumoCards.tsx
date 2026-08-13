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
    /* Ícone acima do texto: são seis KPIs em colunas estreitas, e com o texto
       grande o ícone ao lado não deixaria largura para o valor. */
    <div className="bg-card shadow-elevacao border border-border rounded-xl p-4 sm:p-5 flex flex-col gap-2">
      <div className={`p-2.5 rounded-lg self-start ${color} bg-opacity-15`}>
        <Icon className={`w-5 h-5 ${color.replace("bg-", "text-")}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide break-words">
          {title}
        </p>
        {loading ? (
          <div className="h-7 w-20 bg-superficie rounded animate-pulse mt-1" />
        ) : (
          <p className="text-xl sm:text-2xl font-bold text-foreground mt-0.5 break-words">
            {value}
          </p>
        )}
        {subtitle && (
          <p className="text-xs text-muted-suave mt-0.5 break-words">{subtitle}</p>
        )}
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
          <span className="text-sm text-brand-accent font-medium capitalize">
            {resumo!.periodo!.label}
          </span>
          {comparativoTxt && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                diff > 0
                  ? "bg-emerald-500/15 text-sucesso"
                  : diff < 0
                  ? "bg-red-500/15 text-erro"
                  : "bg-superficie-forte text-foreground-suave"
              }`}
            >
              {comparativoTxt}
            </span>
          )}
        </div>
      )}

      {/* Largura mínima da coluna em rem: cresce junto com a preferência de
          tamanho de texto, então o navegador reduz o número de colunas
          sozinho (6 no normal, como antes, e 4 no "maior") em vez de espremer
          o valor. 9.3rem = 148px é 1/6 da área útil no nível normal. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(9.3rem,1fr))] gap-4">
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

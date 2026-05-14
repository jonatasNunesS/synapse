"use client";

import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
} from "lucide-react";
import type { ResumoFinanceiro } from "@/types/financeiro";

interface ResumoCardsProps {
  resumo: ResumoFinanceiro | null;
  loading?: boolean;
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(valor);
}

interface CardProps {
  titulo: string;
  valor: string;
  icon: React.ReactNode;
  cor: string;
  descricao?: string;
  loading?: boolean;
}

function Card({ titulo, valor, icon, cor, descricao, loading }: CardProps) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 hover:bg-white/[0.05] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-slate-400">{titulo}</p>
        <div className={`p-2 rounded-lg ${cor}`}>{icon}</div>
      </div>
      {loading ? (
        <div className="h-7 w-32 bg-white/10 rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-bold text-white tabular-nums">{valor}</p>
      )}
      {descricao && (
        <p className="text-xs text-slate-500 mt-1">{descricao}</p>
      )}
    </div>
  );
}

export function ResumoCards({ resumo, loading }: ResumoCardsProps) {
  const saldoPositivo = (resumo?.saldo ?? 0) >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        titulo="Total Receitas"
        valor={formatarMoeda(resumo?.total_receitas ?? 0)}
        icon={<ArrowUpCircle className="w-4 h-4 text-emerald-400" />}
        cor="bg-emerald-400/10"
        descricao="Receitas pagas no mês"
        loading={loading}
      />
      <Card
        titulo="Total Despesas"
        valor={formatarMoeda(resumo?.total_despesas ?? 0)}
        icon={<ArrowDownCircle className="w-4 h-4 text-red-400" />}
        cor="bg-red-400/10"
        descricao="Despesas pagas no mês"
        loading={loading}
      />
      <Card
        titulo="Saldo do Mês"
        valor={formatarMoeda(resumo?.saldo ?? 0)}
        icon={
          <TrendingUp
            className={`w-4 h-4 ${saldoPositivo ? "text-violet-400" : "text-red-400"}`}
          />
        }
        cor={saldoPositivo ? "bg-violet-400/10" : "bg-red-400/10"}
        descricao="Receitas - Despesas pagas"
        loading={loading}
      />
      <Card
        titulo="A Vencer / Atrasado"
        valor={formatarMoeda(
          (resumo?.total_pendente ?? 0) + (resumo?.total_atrasado ?? 0)
        )}
        icon={<AlertCircle className="w-4 h-4 text-amber-400" />}
        cor="bg-amber-400/10"
        descricao={
          resumo?.total_atrasado
            ? `${formatarMoeda(resumo.total_atrasado)} atrasado`
            : "Nenhum valor atrasado"
        }
        loading={loading}
      />
    </div>
  );
}

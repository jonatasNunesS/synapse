"use client";

import {
  DollarSign,
  Package,
  Users,
  FolderOpen,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardResumo } from "@/types/dashboard";

interface KPICardProps {
  titulo: string;
  valor: string;
  subtitulo: string;
  icone: React.ReactNode;
  cor: string;
  tendencia?: "positiva" | "negativa" | "neutra";
  alerta?: boolean;
}

function KPICard({ titulo, valor, subtitulo, icone, cor, tendencia, alerta }: KPICardProps) {
  return (
    <Card className={`border-l-4 ${cor} hover:shadow-md transition-shadow`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">{titulo}</p>
            <p className="text-2xl font-bold text-foreground mt-1 truncate">{valor}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">{subtitulo}</p>
          </div>
          <div className={`p-2.5 rounded-lg ml-3 flex-shrink-0 ${alerta ? "bg-red-50" : "bg-muted"}`}>
            {icone}
          </div>
        </div>
        {tendencia && (
          <div className="flex items-center gap-1 mt-3">
            {tendencia === "positiva" ? (
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            ) : tendencia === "negativa" ? (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KPICardSkeleton() {
  return (
    <Card className="border-l-4 border-l-gray-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

interface KPIGridProps {
  resumo: DashboardResumo | undefined;
  isLoading: boolean;
}

export function KPIGrid({ resumo, isLoading }: KPIGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!resumo) return null;

  const { financeiro, estoque, crm, projetos } = resumo;

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const kpis: KPICardProps[] = [
    {
      titulo: "Receitas do Mês",
      valor: formatCurrency(financeiro.total_receitas),
      subtitulo: `${financeiro.lancamentos_count} lançamentos`,
      icone: <DollarSign className="h-5 w-5 text-green-600" />,
      cor: "border-l-green-500",
      tendencia: financeiro.saldo_mes >= 0 ? "positiva" : "negativa",
    },
    {
      titulo: "Despesas do Mês",
      valor: formatCurrency(financeiro.total_despesas),
      subtitulo: `Saldo: ${formatCurrency(financeiro.saldo_mes)}`,
      icone: <TrendingDown className="h-5 w-5 text-red-600" />,
      cor: "border-l-red-500",
      tendencia: financeiro.saldo_mes >= 0 ? "positiva" : "negativa",
    },
    {
      titulo: "A Receber",
      valor: formatCurrency(financeiro.total_pendente),
      subtitulo: financeiro.total_atrasado > 0
        ? `${formatCurrency(financeiro.total_atrasado)} atrasado`
        : "Sem atrasos",
      icone: <AlertTriangle className={`h-5 w-5 ${financeiro.total_atrasado > 0 ? "text-red-600" : "text-yellow-600"}`} />,
      cor: financeiro.total_atrasado > 0 ? "border-l-red-400" : "border-l-yellow-500",
      alerta: financeiro.total_atrasado > 0,
    },
    {
      titulo: "Produtos em Estoque",
      valor: estoque.total_produtos.toString(),
      subtitulo: estoque.produtos_abaixo_minimo > 0
        ? `${estoque.produtos_abaixo_minimo} abaixo do mínimo`
        : "Estoque saudável",
      icone: <Package className={`h-5 w-5 ${estoque.produtos_abaixo_minimo > 0 ? "text-red-600" : "text-blue-600"}`} />,
      cor: estoque.produtos_abaixo_minimo > 0 ? "border-l-red-400" : "border-l-blue-500",
      alerta: estoque.produtos_abaixo_minimo > 0,
    },
    {
      titulo: "Total de Clientes",
      valor: crm.total_clientes.toString(),
      subtitulo: `${crm.novos_este_mes} novo${crm.novos_este_mes !== 1 ? "s" : ""} este mês`,
      icone: <Users className="h-5 w-5 text-purple-600" />,
      cor: "border-l-purple-500",
      tendencia: crm.novos_este_mes > 0 ? "positiva" : "neutra",
    },
    {
      titulo: "Ticket Médio",
      valor: formatCurrency(crm.ticket_medio_geral),
      subtitulo: `Total gerado: ${formatCurrency(crm.valor_total_gerado)}`,
      icone: <TrendingUp className="h-5 w-5 text-indigo-600" />,
      cor: "border-l-indigo-500",
    },
    {
      titulo: "Projetos Ativos",
      valor: projetos.projetos_ativos.toString(),
      subtitulo: projetos.projetos_atrasados > 0
        ? `${projetos.projetos_atrasados} atrasado${projetos.projetos_atrasados !== 1 ? "s" : ""}`
        : "Todos no prazo",
      icone: <FolderOpen className={`h-5 w-5 ${projetos.projetos_atrasados > 0 ? "text-red-600" : "text-cyan-600"}`} />,
      cor: projetos.projetos_atrasados > 0 ? "border-l-red-400" : "border-l-cyan-500",
      alerta: projetos.projetos_atrasados > 0,
    },
    {
      titulo: "Minhas Tarefas",
      valor: projetos.tarefas_minhas.toString(),
      subtitulo: projetos.tarefas_atrasadas > 0
        ? `${projetos.tarefas_atrasadas} atrasada${projetos.tarefas_atrasadas !== 1 ? "s" : ""}`
        : "Sem atrasos",
      icone: <CheckSquare className={`h-5 w-5 ${projetos.tarefas_atrasadas > 0 ? "text-red-600" : "text-orange-600"}`} />,
      cor: projetos.tarefas_atrasadas > 0 ? "border-l-red-400" : "border-l-orange-500",
      alerta: projetos.tarefas_atrasadas > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <KPICard key={kpi.titulo} {...kpi} />
      ))}
    </div>
  );
}

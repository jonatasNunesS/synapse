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
import type { ModuloOpcional } from "@/types/auth";
import { useModulos } from "@/hooks/useModulos";
import { formatCurrency } from "@/lib/utils";

/**
 * A largura mínima da coluna está em rem, então ela cresce junto com a
 * preferência de tamanho de texto e o próprio navegador escolhe quantos KPIs
 * cabem por linha: em 1280px são 4 no normal (como antes), 3 no médio/grande e
 * 2 no "maior" — assim o valor nunca precisa ser cortado nem quebrado no meio.
 * 13.75rem = 220px é exatamente a largura de 1/4 da área útil no nível normal.
 */
const GRID_KPI = "grid grid-cols-[repeat(auto-fit,minmax(13.75rem,1fr))] gap-4";

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
        {/* O ícone divide a linha só com o título; o valor ocupa a largura
            inteira do card. Com break-words no lugar de truncate, o número
            continua legível por completo em qualquer tamanho de fonte — o
            card cresce em altura em vez de cortar o texto. */}
        <div className="flex items-start justify-between gap-3">
          <p className="flex-1 min-w-0 text-sm font-medium text-muted-foreground break-words">
            {titulo}
          </p>
          <div className={`p-2.5 rounded-lg flex-shrink-0 ${alerta ? "bg-erro/10" : "bg-muted"}`}>
            {icone}
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground mt-1 break-words">{valor}</p>
        <p className="text-xs text-muted-foreground mt-1 break-words">{subtitulo}</p>
        {tendencia && (
          <div className="flex items-center gap-1 mt-3">
            {tendencia === "positiva" ? (
              <TrendingUp className="h-3.5 w-3.5 text-sucesso" />
            ) : tendencia === "negativa" ? (
              <TrendingDown className="h-3.5 w-3.5 text-erro" />
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
  // KPIs de módulos opcionais desligados não aparecem (Financeiro e Clientes
  // são obrigatórios e ficam sempre).
  const { moduloAtivo } = useModulos();

  if (isLoading) {
    return (
      <div className={GRID_KPI}>
        {Array.from({ length: 8 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!resumo) return null;

  const { financeiro, estoque, crm, projetos } = resumo;


  const kpis: (KPICardProps & { modulo?: ModuloOpcional })[] = [
    {
      titulo: "Receitas do Mês",
      valor: formatCurrency(financeiro.total_receitas),
      subtitulo: `${financeiro.lancamentos_count} lançamentos`,
      icone: <DollarSign className="h-5 w-5 text-sucesso" />,
      cor: "border-l-green-500",
      tendencia: financeiro.saldo_mes >= 0 ? "positiva" : "negativa",
    },
    {
      titulo: "Despesas do Mês",
      valor: formatCurrency(financeiro.total_despesas),
      subtitulo: `Saldo: ${formatCurrency(financeiro.saldo_mes)}`,
      icone: <TrendingDown className="h-5 w-5 text-erro" />,
      cor: "border-l-red-500",
      tendencia: financeiro.saldo_mes >= 0 ? "positiva" : "negativa",
    },
    {
      titulo: "A Receber",
      valor: formatCurrency(financeiro.total_pendente),
      subtitulo: financeiro.total_atrasado > 0
        ? `${formatCurrency(financeiro.total_atrasado)} atrasado`
        : "Sem atrasos",
      icone: <AlertTriangle className={`h-5 w-5 ${financeiro.total_atrasado > 0 ? "text-erro" : "text-alerta"}`} />,
      cor: financeiro.total_atrasado > 0 ? "border-l-red-400" : "border-l-yellow-500",
      alerta: financeiro.total_atrasado > 0,
    },
    {
      modulo: "estoque",
      titulo: "Produtos em Estoque",
      valor: estoque.total_produtos.toString(),
      subtitulo: estoque.produtos_abaixo_minimo > 0
        ? `${estoque.produtos_abaixo_minimo} abaixo do mínimo`
        : "Estoque saudável",
      icone: <Package className={`h-5 w-5 ${estoque.produtos_abaixo_minimo > 0 ? "text-erro" : "text-info"}`} />,
      cor: estoque.produtos_abaixo_minimo > 0 ? "border-l-red-400" : "border-l-blue-500",
      alerta: estoque.produtos_abaixo_minimo > 0,
    },
    {
      titulo: "Total de Clientes",
      valor: crm.total_clientes.toString(),
      subtitulo: `${crm.novos_este_mes} novo${crm.novos_este_mes !== 1 ? "s" : ""} este mês`,
      icone: <Users className="h-5 w-5 text-brand-accent" />,
      cor: "border-l-brand-500",
      tendencia: crm.novos_este_mes > 0 ? "positiva" : "neutra",
    },
    {
      titulo: "Ticket Médio",
      valor: formatCurrency(crm.ticket_medio_geral),
      subtitulo: `Total gerado: ${formatCurrency(crm.valor_total_gerado)}`,
      icone: <TrendingUp className="h-5 w-5 text-brand-accent" />,
      cor: "border-l-brand-500",
    },
    {
      modulo: "projetos",
      titulo: "Projetos Ativos",
      valor: projetos.projetos_ativos.toString(),
      subtitulo: projetos.projetos_atrasados > 0
        ? `${projetos.projetos_atrasados} atrasado${projetos.projetos_atrasados !== 1 ? "s" : ""}`
        : "Todos no prazo",
      icone: <FolderOpen className={`h-5 w-5 ${projetos.projetos_atrasados > 0 ? "text-erro" : "text-info"}`} />,
      cor: projetos.projetos_atrasados > 0 ? "border-l-red-400" : "border-l-cyan-500",
      alerta: projetos.projetos_atrasados > 0,
    },
    {
      modulo: "projetos",
      titulo: "Minhas Tarefas",
      valor: projetos.tarefas_minhas.toString(),
      subtitulo: projetos.tarefas_atrasadas > 0
        ? `${projetos.tarefas_atrasadas} atrasada${projetos.tarefas_atrasadas !== 1 ? "s" : ""}`
        : "Sem atrasos",
      icone: <CheckSquare className={`h-5 w-5 ${projetos.tarefas_atrasadas > 0 ? "text-erro" : "text-alerta"}`} />,
      cor: projetos.tarefas_atrasadas > 0 ? "border-l-red-400" : "border-l-orange-500",
      alerta: projetos.tarefas_atrasadas > 0,
    },
  ];

  return (
    <div className={GRID_KPI}>
      {kpis
        .filter((kpi) => !kpi.modulo || moduloAtivo(kpi.modulo))
        .map(({ modulo: _modulo, ...kpi }) => (
          <KPICard key={kpi.titulo} {...kpi} />
        ))}
    </div>
  );
}

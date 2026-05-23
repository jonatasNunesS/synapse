"use client";

/**
 * Synapse — M8: Dashboard Executivo
 * Página principal com KPIs, widgets e atividade recente.
 */

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";

// Hooks M8
import {
  useDashboardResumo,
  useDashboardFluxoCaixa,
  useDashboardFunil,
  useDashboardVencimentos,
  useDashboardFollowUps,
  useDashboardMinhasTarefas,
  useDashboardAlertasEstoque,
  useDashboardProjetos,
  useDashboardAtividade,
} from "@/hooks/useDashboard";

// Componentes M8
import { BoasVindasCard } from "@/components/dashboard/BoasVindasCard";
import { KPIGrid } from "@/components/dashboard/KPIGrid";
import { FluxoCaixaWidget } from "@/components/dashboard/FluxoCaixaWidget";
import { FunilWidget } from "@/components/dashboard/FunilWidget";
import { VencimentosWidget } from "@/components/dashboard/VencimentosWidget";
import { FollowUpsWidget } from "@/components/dashboard/FollowUpsWidget";
import { MinhasTarefasWidget } from "@/components/dashboard/MinhasTarefasWidget";
import { AlertasEstoqueWidget } from "@/components/dashboard/AlertasEstoqueWidget";
import { ProjetosWidget } from "@/components/dashboard/ProjetosWidget";
import { AtividadeWidget } from "@/components/dashboard/AtividadeWidget";

export default function DashboardPage() {
  const { usuario } = useAppStore();

  // ── Dados ─────────────────────────────────────────────────
  const { resumo, isLoading: loadingResumo, refresh: refreshResumo } = useDashboardResumo();
  const { fluxo, isLoading: loadingFluxo } = useDashboardFluxoCaixa(30);
  const { etapas, isLoading: loadingFunil } = useDashboardFunil();
  const { vencimentos, isLoading: loadingVencimentos } = useDashboardVencimentos(7);
  const { followups, isLoading: loadingFollowUps } = useDashboardFollowUps(3);
  const { tarefas, isLoading: loadingTarefas } = useDashboardMinhasTarefas();
  const { alertas, isLoading: loadingAlertas } = useDashboardAlertasEstoque();
  const { projetos, isLoading: loadingProjetos } = useDashboardProjetos();
  const { eventos, isLoading: loadingAtividade } = useDashboardAtividade(10);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* ── Cabeçalho ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visão executiva do seu negócio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshResumo()}
            className="gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/analytics">Analytics</a>
          </Button>
        </div>
      </div>

      {/* ── Boas-vindas ────────────────────────────────────── */}
      <BoasVindasCard
        resumo={resumo}
        nomeUsuario={usuario?.nome ?? "Usuário"}
        isLoading={loadingResumo}
      />

      {/* ── KPIs ───────────────────────────────────────────── */}
      <KPIGrid resumo={resumo} isLoading={loadingResumo} />

      {/* ── Linha 1: Fluxo de Caixa + Funil ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FluxoCaixaWidget fluxo={fluxo} isLoading={loadingFluxo} />
        <FunilWidget etapas={etapas} isLoading={loadingFunil} />
      </div>

      {/* ── Linha 2: Vencimentos + Follow-ups ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VencimentosWidget vencimentos={vencimentos} isLoading={loadingVencimentos} />
        <FollowUpsWidget followups={followups} isLoading={loadingFollowUps} />
      </div>

      {/* ── Linha 3: Minhas Tarefas + Alertas de Estoque ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MinhasTarefasWidget tarefas={tarefas} isLoading={loadingTarefas} />
        <AlertasEstoqueWidget alertas={alertas} isLoading={loadingAlertas} />
      </div>

      {/* ── Linha 4: Projetos + Atividade Recente ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProjetosWidget projetos={projetos} isLoading={loadingProjetos} />
        <AtividadeWidget eventos={eventos} isLoading={loadingAtividade} />
      </div>
    </div>
  );
}



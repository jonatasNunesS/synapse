"use client";

// Synapse — M8 Dashboard: Hooks
import { useCallback, useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import type {
  DashboardAtividade,
  DashboardAlertasEstoque,
  DashboardFluxoCaixa,
  DashboardFollowUps,
  DashboardFunil,
  DashboardMinhasTarefas,
  DashboardProjetos2,
  DashboardResumo,
  DashboardVencimentos,
  PeriodoAnalytics,
  PERIODOS,
} from "@/types/dashboard";

// ════════════════════════════════════════════════════════════
// FETCHER PADRÃO
// ════════════════════════════════════════════════════════════

const fetcher = (url: string) =>
  api.get(url).then((res) => {
    if (!res.data.success) throw new Error(res.data.error?.message || "Erro");
    return res.data.data;
  });

// ════════════════════════════════════════════════════════════
// HOOK: RESUMO PRINCIPAL
// ════════════════════════════════════════════════════════════

export function useDashboardResumo() {
  const { data, error, isLoading, mutate } = useSWR<DashboardResumo>(
    "/dashboard/resumo/",
    fetcher,
    {
      refreshInterval: 60_000, // Atualiza a cada 1 minuto
      revalidateOnFocus: true,
    }
  );

  return {
    resumo: data,
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}

// ════════════════════════════════════════════════════════════
// HOOK: FLUXO DE CAIXA
// ════════════════════════════════════════════════════════════

export function useDashboardFluxoCaixa(dias: number = 30) {
  const { data, error, isLoading, mutate } = useSWR<DashboardFluxoCaixa>(
    `/dashboard/fluxo-caixa/?dias=${dias}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    fluxo: data?.fluxo ?? [],
    dias: data?.dias ?? dias,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

// ════════════════════════════════════════════════════════════
// HOOK: FUNIL DE VENDAS
// ════════════════════════════════════════════════════════════

export function useDashboardFunil() {
  const { data, error, isLoading, mutate } = useSWR<DashboardFunil>(
    "/dashboard/funil-vendas/",
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    funil: data,
    etapas: data?.etapas ?? [],
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

// ════════════════════════════════════════════════════════════
// HOOK: VENCIMENTOS PRÓXIMOS
// ════════════════════════════════════════════════════════════

export function useDashboardVencimentos(dias: number = 7) {
  const { data, error, isLoading, mutate } = useSWR<DashboardVencimentos>(
    `/dashboard/vencimentos/?dias=${dias}`,
    fetcher,
    { refreshInterval: 300_000 } // 5 minutos
  );

  return {
    vencimentos: data?.vencimentos ?? [],
    dias: data?.dias ?? dias,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

// ════════════════════════════════════════════════════════════
// HOOK: FOLLOW-UPS
// ════════════════════════════════════════════════════════════

export function useDashboardFollowUps(dias: number = 3) {
  const { data, error, isLoading, mutate } = useSWR<DashboardFollowUps>(
    `/dashboard/followups/?dias=${dias}`,
    fetcher,
    { refreshInterval: 300_000 }
  );

  return {
    followups: data?.followups ?? [],
    dias: data?.dias ?? dias,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

// ════════════════════════════════════════════════════════════
// HOOK: MINHAS TAREFAS
// ════════════════════════════════════════════════════════════

export function useDashboardMinhasTarefas() {
  const { data, error, isLoading, mutate } = useSWR<DashboardMinhasTarefas>(
    "/dashboard/minhas-tarefas/",
    fetcher,
    { refreshInterval: 120_000 } // 2 minutos
  );

  return {
    tarefas: data?.tarefas ?? [],
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

// ════════════════════════════════════════════════════════════
// HOOK: ALERTAS DE ESTOQUE
// ════════════════════════════════════════════════════════════

export function useDashboardAlertasEstoque() {
  const { data, error, isLoading, mutate } = useSWR<DashboardAlertasEstoque>(
    "/dashboard/alertas-estoque/",
    fetcher,
    { refreshInterval: 300_000 }
  );

  return {
    alertas: data?.alertas ?? [],
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

// ════════════════════════════════════════════════════════════
// HOOK: PROJETOS EM ANDAMENTO
// ════════════════════════════════════════════════════════════

export function useDashboardProjetos() {
  const { data, error, isLoading, mutate } = useSWR<DashboardProjetos2>(
    "/dashboard/projetos/",
    fetcher,
    { refreshInterval: 120_000 }
  );

  return {
    projetos: data?.projetos ?? [],
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

// ════════════════════════════════════════════════════════════
// HOOK: ATIVIDADE RECENTE
// ════════════════════════════════════════════════════════════

export function useDashboardAtividade(limit: number = 10) {
  const { data, error, isLoading, mutate } = useSWR<DashboardAtividade>(
    `/dashboard/atividade/?limit=${limit}`,
    fetcher,
    { refreshInterval: 60_000 }
  );

  return {
    eventos: data?.eventos ?? [],
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

// ════════════════════════════════════════════════════════════
// HOOK: ANALYTICS (Fluxo de caixa com período selecionável)
// ════════════════════════════════════════════════════════════

export function useAnalytics() {
  const [periodo, setPeriodo] = useState<PeriodoAnalytics>("30d");

  const diasMap: Record<PeriodoAnalytics, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "365d": 365,
  };

  const dias = diasMap[periodo];

  const fluxoCaixa = useDashboardFluxoCaixa(dias);
  const funil = useDashboardFunil();
  const resumo = useDashboardResumo();

  const handlePeriodoChange = useCallback((novoPeriodo: PeriodoAnalytics) => {
    setPeriodo(novoPeriodo);
  }, []);

  return {
    periodo,
    dias,
    setPeriodo: handlePeriodoChange,
    fluxoCaixa,
    funil,
    resumo,
    isLoading: fluxoCaixa.isLoading || funil.isLoading || resumo.isLoading,
  };
}

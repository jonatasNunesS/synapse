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
  DashboardProximosCompromissos,
  DashboardResumo,
  DashboardVencimentos,
  PeriodoAnalytics,
} from "@/types/dashboard";
// BAIXO-7: PERIODOS é um valor (const), não um tipo — importar sem `type`
import { PERIODOS } from "@/types/dashboard";

// ════════════════════════════════════════════════════════════
// FETCHER PADRÃO
// ════════════════════════════════════════════════════════════

// ALTO-9: fetcher correto — api.get<T> retorna ApiResponse<T>, então res.data = T
// Não usar api.get<ApiResponse<T>> que resulta em ApiResponse<ApiResponse<T>>
const fetcher = <T>(url: string): Promise<T> =>
  api.get<T>(url).then((res) => res.data);

// ════════════════════════════════════════════════════════════
// INDISPONÍVEL
// ════════════════════════════════════════════════════════════
//
// Cada hook devolve `indisponivel`, que junta as DUAS formas de o dado não
// chegar:
//
//   1. a requisição não voltou (rede, 500) → o SWR dá `error`
//   2. voltou 200, mas o bloco veio `null` → o backend marcou degradação
//
// Para quem olha a tela as duas são a mesma coisa: não sabemos. Então o widget
// recebe um booleano e mostra um aviso, em vez de ter de conhecer a diferença.
//
// O caso (1) também era silencioso antes desta leva: com o endpoint em 500, o
// hook devolvia `[]` e o widget exibia "Nenhum vencimento próximo" — negando a
// existência de vencimentos que ninguém chegou a consultar.

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
    // O resumo não tem um `indisponivel` só: cada bloco (financeiro, estoque,
    // CRM…) falha por conta própria, e quem decide é o cartão que o lê. Aqui
    // só a falha da requisição inteira, que derruba todos de uma vez.
    indisponivel: !!error,
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
    indisponivel: !!error || data?.fluxo === null,
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
    indisponivel: !!error || data?.etapas === null,
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
    indisponivel: !!error || data?.vencimentos === null,
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
    indisponivel: !!error || data?.followups === null,
    dias: data?.dias ?? dias,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

// ════════════════════════════════════════════════════════════
// HOOK: PRÓXIMOS COMPROMISSOS (Agenda)
// ════════════════════════════════════════════════════════════

export function useDashboardProximosCompromissos(dias: number = 7) {
  const { data, error, isLoading, mutate } = useSWR<DashboardProximosCompromissos>(
    `/dashboard/proximos-compromissos/?dias=${dias}`,
    fetcher,
    // 2 min: o mesmo TTL do cache do backend. Adiantar o refresh só gastaria
    // requisição para receber a mesma resposta guardada.
    { refreshInterval: 120_000 }
  );

  return {
    compromissos: data?.compromissos ?? [],
    indisponivel: !!error || data?.compromissos === null,
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
    indisponivel: !!error || data?.tarefas === null,
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
    indisponivel: !!error || data?.alertas === null,
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
    indisponivel: !!error || data?.projetos === null,
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
    indisponivel: !!error || data?.eventos === null,
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
    periodos: PERIODOS,
    setPeriodo: handlePeriodoChange,
    fluxoCaixa,
    funil,
    resumo,
    isLoading: fluxoCaixa.isLoading || funil.isLoading || resumo.isLoading,
  };
}

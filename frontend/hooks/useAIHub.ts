/**
 * Synapse - useAIHub Hook (M9)
 * Gerencia geração de conteúdo, polling de status, histórico e uso da IA.
 */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import type {
  ConteudoGerado,
  TaskIA,
  UsoIA,
  SolicitacaoConteudo,
  TipoConteudo,
} from "@/types/ai_hub";

// ─── SWR Keys ─────────────────────────────────────────────────────────────────
const KEYS = {
  uso: "/ai/uso/",
  historico: (tipo?: string, favorito?: boolean) => {
    let url = "/ai/historico/";
    const params: string[] = [];
    if (tipo) params.push(`tipo=${tipo}`);
    if (favorito !== undefined) params.push(`favorito=${favorito}`);
    if (params.length) url += `?${params.join("&")}`;
    return url;
  },
  insight: "/ai/insight/",
};

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useAIHub() {
  const [gerando, setGerando] = useState(false);
  const [taskAtual, setTaskAtual] = useState<TaskIA | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Uso mensal
  const { data: usoData, mutate: mutateUso } = useSWR<{ success: boolean; data: UsoIA }>(
    KEYS.uso,
    (url: string) => api.get(url).then((r) => r.data),
    { refreshInterval: 60000 }
  );

  // Insight semanal
  const { data: insightData } = useSWR<{ success: boolean; data: ConteudoGerado | null }>(
    KEYS.insight,
    (url: string) => api.get(url).then((r) => r.data)
  );

  // Parar polling ao desmontar
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Polling de status da task
  const iniciarPolling = useCallback(
    (taskId: string, onConcluido: (resultado: string) => void) => {
      if (pollingRef.current) clearInterval(pollingRef.current);

      pollingRef.current = setInterval(async () => {
        try {
          const resp = await api.get(`/ai/status/${taskId}/`);
          const task: TaskIA = resp.data.data;
          setTaskAtual(task);

          if (task.status === "concluido") {
            clearInterval(pollingRef.current!);
            pollingRef.current = null;
            setGerando(false);
            mutateUso();
            if (task.resultado) onConcluido(task.resultado);
          } else if (task.status === "erro") {
            clearInterval(pollingRef.current!);
            pollingRef.current = null;
            setGerando(false);
            setErro(task.erro || "Erro ao gerar conteúdo.");
          }
        } catch {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setGerando(false);
          setErro("Erro ao verificar status da geração.");
        }
      }, 2000); // Polling a cada 2 segundos
    },
    [mutateUso]
  );

  // Solicitar geração
  const gerarConteudo = useCallback(
    async (
      solicitacao: SolicitacaoConteudo,
      onConcluido: (resultado: string) => void
    ): Promise<void> => {
      setGerando(true);
      setErro(null);
      setTaskAtual(null);

      try {
        const resp = await api.post("/ai/gerar/", solicitacao);
        const task: TaskIA = resp.data.data;
        setTaskAtual(task);
        iniciarPolling(task.id, onConcluido);
      } catch (err: unknown) {
        setGerando(false);
        const axiosErr = err as { response?: { data?: { error?: { message?: string } }; status?: number } };
        if (axiosErr.response?.status === 429) {
          setErro(
            axiosErr.response.data?.error?.message ||
              "Limite de gerações atingido. Faça upgrade do plano."
          );
        } else {
          setErro(
            axiosErr.response?.data?.error?.message || "Erro ao solicitar geração."
          );
        }
      }
    },
    [iniciarPolling]
  );

  // Toggle favorito
  const toggleFavorito = useCallback(async (conteudoId: string): Promise<void> => {
    await api.post(`/ai/favoritar/${conteudoId}/`);
  }, []);

  return {
    // Estado
    gerando,
    taskAtual,
    erro,
    setErro,
    // Dados
    uso: usoData?.data ?? null,
    insight: insightData?.data ?? null,
    // Ações
    gerarConteudo,
    toggleFavorito,
    mutateUso,
  };
}

// ─── Hook de histórico ────────────────────────────────────────────────────────
export function useHistoricoConteudos(
  tipo?: TipoConteudo | "",
  favorito?: boolean
) {
  const key = KEYS.historico(tipo || undefined, favorito);

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: ConteudoGerado[];
    pagination: { count: number; next: string | null; previous: string | null };
  }>(key, (url: string) => api.get(url).then((r) => r.data));

  const toggleFavorito = useCallback(
    async (conteudoId: string) => {
      await api.post(`/ai/favoritar/${conteudoId}/`);
      mutate();
    },
    [mutate]
  );

  return {
    conteudos: data?.data ?? [],
    pagination: data?.pagination ?? null,
    isLoading,
    error,
    toggleFavorito,
    mutate,
  };
}

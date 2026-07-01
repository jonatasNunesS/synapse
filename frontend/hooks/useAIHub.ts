/**
 * Synapse - useAIHub Hook (M9)
 * Gerencia geração de conteúdo, polling de status, histórico e uso da IA.
 */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { ApiError } from "@/types/api";
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

  // Uso mensal — padrão api.get<T>: resp.data = T
  const { data: usoData, mutate: mutateUso } = useSWR<UsoIA>(
    KEYS.uso,
    (url: string) => api.get<UsoIA>(url).then((r) => r.data),
    { refreshInterval: 60000 }
  );

  // Insight semanal
  const { data: insightData } = useSWR<ConteudoGerado | null>(
    KEYS.insight,
    (url: string) => api.get<ConteudoGerado | null>(url).then((r) => r.data)
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
          // CRÍTICO-3: padrão correto — api.get<TaskIA> → resp.data = TaskIA
          const resp = await api.get<TaskIA>(`/ai/status/${taskId}/`);
          const task: TaskIA = resp.data;
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
        // CRÍTICO-3: padrão correto — api.post<TaskIA> → resp.data = TaskIA
        const resp = await api.post<TaskIA>("/ai/gerar/", solicitacao);
        const task: TaskIA = resp.data;
        setTaskAtual(task);
        iniciarPolling(task.id, onConcluido);
      } catch (err: unknown) {
        setGerando(false);
        // BAIXO-6: usar padrão ApiError (fetch nativo), não axios
        const apiErr = err as ApiError;
        if (
          apiErr?.error?.code === "LIMIT_EXCEEDED" ||
          apiErr?.error?.code === "PLANO_INSUFICIENTE"
        ) {
          setErro(
            apiErr.error.message || "Limite de gerações atingido. Faça upgrade do plano."
          );
        } else {
          // Incluir details (erros por campo do serializer) — o message
          // genérico "Dados inválidos." sozinho não diz qual campo falhou
          const detalhes = apiErr?.error?.details
            ? Object.values(apiErr.error.details).flat().join(" ")
            : "";
          const mensagem = [apiErr?.error?.message, detalhes]
            .filter(Boolean)
            .join(" ");
          setErro(mensagem || "Erro ao solicitar geração.");
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
    uso: usoData ?? null,
    insight: insightData ?? null,
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

  interface HistoricoResponse {
    data: ConteudoGerado[];
    pagination: { count: number; next: string | null; previous: string | null };
  }

  const { data, error, isLoading, mutate } = useSWR<HistoricoResponse>(
    key,
    (url: string) => api.get<HistoricoResponse>(url).then((r) => r.data)
  );

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

/**
 * Synapse — useAnaliseFinanceira (AI Hub 2.0)
 * Solicita a análise financeira e faz polling em /ai/status/{id}/ (reaproveita
 * a infra de TaskIA). Erros SEMPRE propagam para o caller dar toast — nunca
 * engolidos.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { TaskIA } from "@/types/ai_hub";
import type {
  AnaliseFinanceira,
  SolicitarAnaliseResposta,
} from "@/types/analise_financeira";

type Estado = "idle" | "processando" | "sem_dados" | "concluido" | "erro";

export function useAnaliseFinanceira() {
  const [estado, setEstado] = useState<Estado>("idle");
  const [analise, setAnalise] = useState<AnaliseFinanceira | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pararPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => () => pararPolling(), [pararPolling]);

  const iniciarPolling = useCallback(
    (taskId: string) => {
      pararPolling();
      pollingRef.current = setInterval(async () => {
        try {
          const resp = await api.get<TaskIA>(`/ai/status/${taskId}/`);
          const task = resp.data as TaskIA;
          if (task.status === "concluido") {
            pararPolling();
            setAnalise(JSON.parse(task.resultado || "{}") as AnaliseFinanceira);
            setEstado("concluido");
          } else if (task.status === "erro") {
            pararPolling();
            setMensagem(task.erro || "Erro ao gerar a análise.");
            setEstado("erro");
          }
        } catch {
          pararPolling();
          setMensagem("Erro ao verificar o status da análise.");
          setEstado("erro");
        }
      }, 2000);
    },
    [pararPolling]
  );

  /** Dispara a análise. Propaga erro (ex.: 429 limite) para o caller. */
  const analisar = useCallback(
    async (): Promise<void> => {
      setEstado("processando");
      setAnalise(null);
      setMensagem(null);
      try {
        const resp = await api.post<SolicitarAnaliseResposta>(
          "/ai/analise-financeira/"
        );
        const data = resp.data as SolicitarAnaliseResposta;
        if (data.status === "sem_dados") {
          setMensagem(data.message);
          setEstado("sem_dados");
        } else if (data.status === "concluido") {
          setAnalise(data.analise);
          setEstado("concluido");
        } else {
          iniciarPolling(data.task_id);
        }
      } catch (err) {
        setEstado("erro");
        throw err; // caller mostra toast
      }
    },
    [iniciarPolling]
  );

  return { estado, analise, mensagem, analisar };
}

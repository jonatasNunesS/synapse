/**
 * Synapse — useChatFinanceiro (AI Hub).
 * Conversa restrita ao financeiro do usuário. Cada pergunta custa 2 créditos.
 * Reaproveita a infra de TaskIA (Celery + polling em /ai/status/{id}/).
 *
 * O histórico vive SÓ nesta sessão (memória do frontend) — não persiste no
 * banco. Erros de crédito (402) propagam para o caller dar toast + CTA.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api";
import { recarregarCreditos } from "@/hooks/useCreditos";
import type { ApiError } from "@/types/api";
import type { TaskIA } from "@/types/ai_hub";
import type {
  ChatMensagem,
  PerguntaChatResposta,
} from "@/types/chat_financeiro";

// Espelha MAX_HISTORICO do backend: só as últimas mensagens dão continuidade.
const MAX_HISTORICO = 5;

export function useChatFinanceiro() {
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([]);
  const [enviando, setEnviando] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pararPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => () => pararPolling(), [pararPolling]);

  const iniciarPolling = useCallback(
    (taskId: string) =>
      new Promise<void>((resolve, reject) => {
        pararPolling();
        pollingRef.current = setInterval(async () => {
          try {
            const resp = await api.get<TaskIA>(`/ai/status/${taskId}/`);
            const task = resp.data as TaskIA;
            if (task.status === "concluido") {
              pararPolling();
              setMensagens((prev) => [
                ...prev,
                { role: "assistant", content: task.resultado || "" },
              ]);
              resolve();
            } else if (task.status === "erro") {
              pararPolling();
              reject(new Error(task.erro || "Erro ao responder."));
            }
          } catch {
            pararPolling();
            reject(new Error("Erro ao verificar o status da resposta."));
          }
        }, 2000);
      }),
    [pararPolling]
  );

  /**
   * Envia uma pergunta. Adiciona a mensagem do usuário na hora, envia o
   * histórico curto (últimas mensagens) e aguarda a resposta via polling.
   * Propaga erro (ex.: 402 sem créditos) para o caller mostrar toast.
   */
  const perguntar = useCallback(
    async (texto: string): Promise<void> => {
      const pergunta = texto.trim();
      if (!pergunta || enviando) return;

      // Histórico curto = conversa até agora (antes desta pergunta).
      const historico = mensagens.slice(-MAX_HISTORICO);

      setEnviando(true);
      setMensagens((prev) => [...prev, { role: "user", content: pergunta }]);

      try {
        const resp = await api.post<PerguntaChatResposta>(
          "/ai/chat-financeiro/pergunta/",
          { pergunta, historico }
        );
        // A reserva já debitou o crédito → atualiza o badge na hora.
        recarregarCreditos();
        const data = resp.data as PerguntaChatResposta;
        await iniciarPolling(data.task_id);
      } catch (err) {
        // Remove a pergunta otimista que não teve resposta e propaga o erro.
        setMensagens((prev) => prev.slice(0, -1));
        const apiErr = err as ApiError;
        if (apiErr?.error?.code === "SEM_CREDITOS") {
          throw new Error(
            apiErr.error.message ||
              "Sem créditos hoje. Renova à 00:00 ou faça upgrade do plano."
          );
        }
        throw new Error(getErrorMessage(err));
      } finally {
        setEnviando(false);
        // Confirmação/devolução do crédito já ocorreu no backend → sincroniza.
        recarregarCreditos();
      }
    },
    [mensagens, enviando, iniciarPolling]
  );

  const limpar = useCallback(() => {
    pararPolling();
    setMensagens([]);
    setEnviando(false);
  }, [pararPolling]);

  return { mensagens, enviando, perguntar, limpar };
}

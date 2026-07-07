/**
 * Synapse — Tipos do Chat Financeiro (AI Hub).
 * O histórico vive só na sessão do frontend — não é persistido no banco.
 */

export type ChatRole = "user" | "assistant";

export interface ChatMensagem {
  role: ChatRole;
  content: string;
}

// Corpo do POST /api/ai/chat-financeiro/pergunta/
export interface PerguntaChatBody {
  pergunta: string;
  historico: ChatMensagem[];
}

// Resposta imediata do POST (dispara a IA; polla em /ai/status/{id}/)
export interface PerguntaChatResposta {
  status: "processando";
  task_id: string;
}

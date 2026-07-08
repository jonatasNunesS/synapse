/**
 * Synapse — useChatHistory: conversas do Chat Financeiro no localStorage.
 * Só no navegador (não persiste no backend). Isolado por usuário + empresa.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  carregarConversas,
  excluirConversa as excluirNaLista,
  gerarTitulo,
  novoId,
  salvarConversas,
  storageKey,
  upsertConversa,
  type Conversa,
} from "@/lib/chatHistory";
import type { ChatMensagem } from "@/types/chat_financeiro";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function useChatHistory(
  usuarioId: string | null | undefined,
  empresaId: string | null | undefined
) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const key = storageKey(usuarioId, empresaId);

  // Carrega do storage quando a chave (usuário/empresa) muda.
  useEffect(() => {
    const s = getStorage();
    setConversas(s ? carregarConversas(s, key) : []);
  }, [key]);

  const persistir = useCallback(
    (lista: Conversa[]) => {
      const s = getStorage();
      const salvas = s ? salvarConversas(s, key, lista) : lista.slice(0, 10);
      setConversas(salvas);
      return salvas;
    },
    [key]
  );

  /** Cria/atualiza a conversa a partir das mensagens atuais. Retorna o id. */
  const salvar = useCallback(
    (
      id: string | null,
      mensagens: ChatMensagem[],
      tituloManual?: string
    ): string | null => {
      if (mensagens.length === 0) return id;
      const agora = Date.now();
      const primeira =
        mensagens.find((m) => m.role === "user")?.content ?? "";
      const existente = id ? conversas.find((c) => c.id === id) : undefined;
      const conversa: Conversa = {
        id: id ?? novoId(),
        titulo:
          tituloManual?.trim() ||
          existente?.titulo ||
          gerarTitulo(primeira),
        mensagens,
        criadoEm: existente?.criadoEm ?? agora,
        atualizadoEm: agora,
      };
      persistir(upsertConversa(conversas, conversa));
      return conversa.id;
    },
    [conversas, persistir]
  );

  const excluir = useCallback(
    (id: string) => {
      persistir(excluirNaLista(conversas, id));
    },
    [conversas, persistir]
  );

  const renomear = useCallback(
    (id: string, titulo: string) => {
      const alvo = conversas.find((c) => c.id === id);
      if (!alvo) return;
      const novoTitulo = titulo.trim() || alvo.titulo;
      persistir(
        upsertConversa(conversas, { ...alvo, titulo: novoTitulo })
      );
    },
    [conversas, persistir]
  );

  return { conversas, salvar, excluir, renomear };
}

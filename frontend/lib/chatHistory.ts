/**
 * Synapse — Histórico local do Chat Financeiro.
 *
 * As conversas ficam APENAS no localStorage do navegador — nunca no backend
 * (dados financeiros sensíveis, LGPD, sem valor comprovado de sincronização).
 * Isolado por usuário + empresa: dois usuários no mesmo navegador não misturam
 * conversas. Guarda no máximo MAX_CONVERSAS (as mais recentes).
 *
 * Estas funções são PURAS e recebem um `StorageLike` injetável — o que as torna
 * testáveis sem DOM. O hook (useChatHistory) liga-as ao window.localStorage.
 */
import type { ChatMensagem } from "@/types/chat_financeiro";

export interface Conversa {
  id: string;
  titulo: string;
  mensagens: ChatMensagem[];
  criadoEm: number;
  atualizadoEm: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const MAX_CONVERSAS = 10;
export const TITULO_MAX = 40;
const PREFIXO = "synapse:chat_financeiro";

/** Chave isolada por empresa + usuário. */
export function storageKey(
  usuarioId: string | null | undefined,
  empresaId: string | null | undefined
): string {
  return `${PREFIXO}:${empresaId ?? "sem_empresa"}:${usuarioId ?? "anon"}`;
}

/** Título auto-gerado: as primeiras TITULO_MAX chars da 1ª pergunta. */
export function gerarTitulo(primeiraPergunta: string): string {
  const limpo = (primeiraPergunta || "").trim().replace(/\s+/g, " ");
  if (!limpo) return "Nova conversa";
  return limpo.length > TITULO_MAX ? `${limpo.slice(0, TITULO_MAX)}…` : limpo;
}

/** ID simples e único o suficiente para uso local. */
export function novoId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Lê e valida a lista do storage (nunca lança — dado corrompido → []). */
export function carregarConversas(storage: StorageLike, key: string): Conversa[] {
  try {
    const bruto = storage.getItem(key);
    if (!bruto) return [];
    const arr = JSON.parse(bruto);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (c): c is Conversa =>
          c &&
          typeof c.id === "string" &&
          typeof c.titulo === "string" &&
          Array.isArray(c.mensagens)
      )
      .sort((a, b) => b.atualizadoEm - a.atualizadoEm);
  } catch {
    return [];
  }
}

/** Persiste no máximo MAX_CONVERSAS (as mais recentes). */
export function salvarConversas(
  storage: StorageLike,
  key: string,
  conversas: Conversa[]
): Conversa[] {
  const ordenadas = [...conversas]
    .sort((a, b) => b.atualizadoEm - a.atualizadoEm)
    .slice(0, MAX_CONVERSAS);
  storage.setItem(key, JSON.stringify(ordenadas));
  return ordenadas;
}

/** Insere ou atualiza uma conversa e devolve a lista já ordenada/limitada. */
export function upsertConversa(lista: Conversa[], conversa: Conversa): Conversa[] {
  const semEla = lista.filter((c) => c.id !== conversa.id);
  return [conversa, ...semEla]
    .sort((a, b) => b.atualizadoEm - a.atualizadoEm)
    .slice(0, MAX_CONVERSAS);
}

/** Remove uma conversa por id. */
export function excluirConversa(lista: Conversa[], id: string): Conversa[] {
  return lista.filter((c) => c.id !== id);
}

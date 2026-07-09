/**
 * Synapse — useCreditos: saldo de créditos diários de IA.
 * Compartilha a chave SWR "/ai/creditos/" com o useAIHub, então gerar/analisar
 * refrescam o mesmo cache (badge atualiza sozinho).
 */
"use client";

import useSWR, { mutate } from "swr";
import { api } from "@/lib/api";
import type { Creditos } from "@/types/creditos";

export const CREDITOS_KEY = "/ai/creditos/";

export function useCreditos() {
  const { data, isLoading } = useSWR<Creditos>(
    CREDITOS_KEY,
    (url: string) => api.get<Creditos>(url).then((r) => r.data as Creditos),
    { refreshInterval: 30000 }
  );
  return { creditos: data ?? null, carregando: isLoading };
}

/** Força o refresh do saldo (chamar após gerar/analisar). */
export function recarregarCreditos() {
  return mutate(CREDITOS_KEY);
}

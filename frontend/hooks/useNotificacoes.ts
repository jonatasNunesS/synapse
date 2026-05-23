// Synapse — M7: Hook do módulo Notificações
"use client";

import useSWR, { mutate } from "swr";
import { api } from "@/lib/api";
import type { Notificacao, ContagemNotificacoes } from "@/types/notificacoes";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { message?: string };
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: { count: number; next: string | null; previous: string | null };
}

const CONTAGEM_KEY = "/notificacoes/contagem/";
const NAO_LIDAS_KEY = "/notificacoes/nao-lidas/";
const LISTA_KEY = "/notificacoes/";

// ── Polling de contagem (a cada 30s) ──────────────────────
export function useContagemNotificacoes() {
  const { data, error, isLoading } = useSWR<ApiResponse<ContagemNotificacoes>>(
    CONTAGEM_KEY,
    (url: string) =>
      api.get<ApiResponse<ContagemNotificacoes>>(url).then((r) => r.data),
    { refreshInterval: 30_000 }
  );

  return {
    count: data?.data?.count ?? 0,
    isLoading,
    error,
  };
}

// ── Notificações não lidas (para o dropdown) ──────────────
export function useNotificacoesNaoLidas() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<ApiResponse<Notificacao[]>>(
    NAO_LIDAS_KEY,
    (url: string) =>
      api.get<ApiResponse<Notificacao[]>>(url).then((r) => r.data),
    { refreshInterval: 30_000 }
  );

  const marcarLida = async (id: string) => {
    await api.patch(`/notificacoes/${id}/marcar-lida/`);
    await revalidate();
    await mutate(CONTAGEM_KEY);
  };

  const marcarTodasLidas = async () => {
    await api.patch("/notificacoes/marcar-todas-lidas/");
    await revalidate();
    await mutate(CONTAGEM_KEY);
    await mutate(LISTA_KEY);
  };

  return {
    notificacoes: data?.data ?? [],
    isLoading,
    error,
    marcarLida,
    marcarTodasLidas,
    revalidate,
  };
}

// ── Lista completa com paginação ──────────────────────────
export function useNotificacoes(params?: {
  tipo?: string;
  lida?: boolean;
  prioridade?: string;
  page?: number;
}) {
  const query = new URLSearchParams();
  if (params?.tipo) query.set("tipo", params.tipo);
  if (params?.lida !== undefined) query.set("lida", String(params.lida));
  if (params?.prioridade) query.set("prioridade", params.prioridade);
  if (params?.page) query.set("page", String(params.page));
  const qs = query.toString();

  const { data, error, isLoading, mutate: revalidate } = useSWR<PaginatedResponse<Notificacao>>(
    `${LISTA_KEY}${qs ? `?${qs}` : ""}`,
    (url: string) =>
      api.get<PaginatedResponse<Notificacao>>(url).then((r) => r.data)
  );

  const marcarLida = async (id: string) => {
    await api.patch(`/notificacoes/${id}/marcar-lida/`);
    await revalidate();
    await mutate(CONTAGEM_KEY);
    await mutate(NAO_LIDAS_KEY);
  };

  const marcarTodasLidas = async () => {
    await api.patch("/notificacoes/marcar-todas-lidas/");
    await revalidate();
    await mutate(CONTAGEM_KEY);
    await mutate(NAO_LIDAS_KEY);
  };

  const deletar = async (id: string) => {
    await api.delete(`/notificacoes/${id}/`);
    await revalidate();
    await mutate(CONTAGEM_KEY);
    await mutate(NAO_LIDAS_KEY);
  };

  return {
    notificacoes: data?.data ?? [],
    pagination: data?.pagination,
    isLoading,
    error,
    marcarLida,
    marcarTodasLidas,
    deletar,
    revalidate,
  };
}

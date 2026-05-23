// Synapse — M7: Hook do módulo Equipe
"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import type {
  MembroEquipe,
  MetaMembro,
  ResumoEquipe,
  MembroFormData,
  MetaFormData,
} from "@/types/equipe";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { message?: string };
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: { count: number; next: string | null; previous: string | null };
}

const MEMBROS_KEY = "/equipe/membros/";
const RESUMO_KEY = "/equipe/resumo/";

// ── Lista de membros ──────────────────────────────────────
export function useMembros(params?: {
  departamento?: string;
  ativo?: boolean;
  busca?: string;
  page?: number;
}) {
  const query = new URLSearchParams();
  if (params?.departamento) query.set("departamento", params.departamento);
  if (params?.ativo !== undefined) query.set("ativo", String(params.ativo));
  if (params?.busca) query.set("busca", params.busca);
  if (params?.page) query.set("page", String(params.page));
  const qs = query.toString();

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<MembroEquipe>>(
    `${MEMBROS_KEY}${qs ? `?${qs}` : ""}`,
    (url: string) =>
      api.get<PaginatedResponse<MembroEquipe>>(url).then((r) => r.data)
  );

  const adicionarMembro = async (dados: MembroFormData): Promise<MembroEquipe> => {
    const res = await api.post<ApiResponse<MembroEquipe>>(MEMBROS_KEY, dados);
    await mutate();
    return res.data.data;
  };

  const atualizarMembro = async (id: string, dados: Partial<MembroFormData>): Promise<MembroEquipe> => {
    const res = await api.patch<ApiResponse<MembroEquipe>>(`/equipe/membros/${id}/`, dados);
    await mutate();
    return res.data.data;
  };

  const removerMembro = async (id: string): Promise<void> => {
    await api.delete(`/equipe/membros/${id}/`);
    await mutate();
  };

  return {
    membros: data?.data ?? [],
    pagination: data?.pagination,
    isLoading,
    error,
    adicionarMembro,
    atualizarMembro,
    removerMembro,
    mutate,
  };
}

// ── Detalhe de membro ─────────────────────────────────────
export function useMembro(id: string) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<MembroEquipe>>(
    id ? `/equipe/membros/${id}/` : null,
    (url: string) =>
      api.get<ApiResponse<MembroEquipe>>(url).then((r) => r.data)
  );

  return {
    membro: data?.data,
    isLoading,
    error,
    mutate,
  };
}

// ── Resumo da equipe ──────────────────────────────────────
export function useResumoEquipe() {
  const { data, error, isLoading } = useSWR<ApiResponse<ResumoEquipe>>(
    RESUMO_KEY,
    (url: string) =>
      api.get<ApiResponse<ResumoEquipe>>(url).then((r) => r.data)
  );

  return {
    resumo: data?.data,
    isLoading,
    error,
  };
}

// ── Metas de um membro ────────────────────────────────────
export function useMetasMembro(membroId: string) {
  const KEY = membroId ? `/equipe/membros/${membroId}/metas/` : null;

  const { data, error, isLoading, mutate } = useSWR<ApiResponse<MetaMembro[]>>(
    KEY,
    (url: string) =>
      api.get<ApiResponse<MetaMembro[]>>(url).then((r) => r.data)
  );

  const criarMeta = async (dados: MetaFormData): Promise<MetaMembro> => {
    const res = await api.post<ApiResponse<MetaMembro>>(KEY!, dados);
    await mutate();
    return res.data.data;
  };

  const atualizarMeta = async (metaId: string, dados: Partial<MetaFormData>): Promise<MetaMembro> => {
    const res = await api.patch<ApiResponse<MetaMembro>>(`/equipe/membros/${membroId}/metas/${metaId}/`, dados);
    await mutate();
    return res.data.data;
  };

  const deletarMeta = async (metaId: string): Promise<void> => {
    await api.delete(`/equipe/membros/${membroId}/metas/${metaId}/`);
    await mutate();
  };

  return {
    metas: data?.data ?? [],
    isLoading,
    error,
    criarMeta,
    atualizarMeta,
    deletarMeta,
    mutate,
  };
}

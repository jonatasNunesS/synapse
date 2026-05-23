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

  const { data, error, isLoading, mutate } = useSWR(
    `${MEMBROS_KEY}${qs ? `?${qs}` : ""}`,
    (url: string) => api.get(url).then((r) => r.data)
  );

  const adicionarMembro = async (dados: MembroFormData): Promise<MembroEquipe> => {
    const res = await api.post(MEMBROS_KEY, dados);
    await mutate();
    return res.data.data;
  };

  const atualizarMembro = async (id: string, dados: Partial<MembroFormData>): Promise<MembroEquipe> => {
    const res = await api.patch(`/equipe/membros/${id}/`, dados);
    await mutate();
    return res.data.data;
  };

  const removerMembro = async (id: string): Promise<void> => {
    await api.delete(`/equipe/membros/${id}/`);
    await mutate();
  };

  return {
    membros: (data?.data ?? []) as MembroEquipe[],
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
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/equipe/membros/${id}/` : null,
    (url: string) => api.get(url).then((r) => r.data)
  );

  return {
    membro: data?.data as MembroEquipe | undefined,
    isLoading,
    error,
    mutate,
  };
}

// ── Resumo da equipe ──────────────────────────────────────
export function useResumoEquipe() {
  const { data, error, isLoading } = useSWR(
    RESUMO_KEY,
    (url: string) => api.get(url).then((r) => r.data)
  );

  return {
    resumo: data?.data as ResumoEquipe | undefined,
    isLoading,
    error,
  };
}

// ── Metas de um membro ────────────────────────────────────
export function useMetasMembro(membroId: string) {
  const KEY = membroId ? `/equipe/membros/${membroId}/metas/` : null;

  const { data, error, isLoading, mutate } = useSWR(
    KEY,
    (url: string) => api.get(url).then((r) => r.data)
  );

  const criarMeta = async (dados: MetaFormData): Promise<MetaMembro> => {
    const res = await api.post(KEY!, dados);
    await mutate();
    return res.data.data;
  };

  const atualizarMeta = async (metaId: string, dados: Partial<MetaFormData>): Promise<MetaMembro> => {
    const res = await api.patch(`/equipe/membros/${membroId}/metas/${metaId}/`, dados);
    await mutate();
    return res.data.data;
  };

  const deletarMeta = async (metaId: string): Promise<void> => {
    await api.delete(`/equipe/membros/${membroId}/metas/${metaId}/`);
    await mutate();
  };

  return {
    metas: (data?.data ?? []) as MetaMembro[],
    isLoading,
    error,
    criarMeta,
    atualizarMeta,
    deletarMeta,
    mutate,
  };
}

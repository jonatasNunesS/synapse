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
import type { ApiResponse } from "@/types/api";

// O fetcher do SWR chama api.get<T> e retorna o ApiResponse<T> completo.
// O SWR armazena ApiResponse<T> como data, então acessamos data.data para obter T.
// CORRETO: api.get<T> retorna ApiResponse<T> onde .data = T (não .data.data).
// Portanto: fetcher retorna ApiResponse<T>, e usamos resp.data diretamente.

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

  const { data: resp, error, isLoading, mutate } = useSWR<ApiResponse<MembroEquipe[]>>(
    `${MEMBROS_KEY}${qs ? `?${qs}` : ""}`,
    (url: string) => api.get<MembroEquipe[]>(url)
  );

  const adicionarMembro = async (dados: MembroFormData): Promise<MembroEquipe> => {
    const res = await api.post<MembroEquipe>(MEMBROS_KEY, dados);
    await mutate();
    return res.data as MembroEquipe;
  };

  const atualizarMembro = async (id: string, dados: Partial<MembroFormData>): Promise<MembroEquipe> => {
    const res = await api.patch<MembroEquipe>(`/equipe/membros/${id}/`, dados);
    await mutate();
    return res.data as MembroEquipe;
  };

  const removerMembro = async (id: string): Promise<void> => {
    await api.delete(`/equipe/membros/${id}/`);
    await mutate();
  };

  return {
    membros: resp?.data ?? [],
    pagination: resp?.pagination,
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
  const { data: resp, error, isLoading, mutate } = useSWR<ApiResponse<MembroEquipe>>(
    id ? `/equipe/membros/${id}/` : null,
    (url: string) => api.get<MembroEquipe>(url)
  );

  return {
    membro: resp?.data,
    isLoading,
    error,
    mutate,
  };
}

// ── Resumo da equipe ──────────────────────────────────────
export function useResumoEquipe() {
  const { data: resp, error, isLoading } = useSWR<ApiResponse<ResumoEquipe>>(
    RESUMO_KEY,
    (url: string) => api.get<ResumoEquipe>(url)
  );

  return {
    resumo: resp?.data,
    isLoading,
    error,
  };
}

// ── Metas de um membro ────────────────────────────────────
export function useMetasMembro(membroId: string) {
  const KEY = membroId ? `/equipe/membros/${membroId}/metas/` : null;

  const { data: resp, error, isLoading, mutate } = useSWR<ApiResponse<MetaMembro[]>>(
    KEY,
    (url: string) => api.get<MetaMembro[]>(url)
  );

  const criarMeta = async (dados: MetaFormData): Promise<MetaMembro> => {
    const res = await api.post<MetaMembro>(KEY!, dados);
    await mutate();
    return res.data as MetaMembro;
  };

  const atualizarMeta = async (metaId: string, dados: Partial<MetaFormData>): Promise<MetaMembro> => {
    const res = await api.patch<MetaMembro>(`/equipe/membros/${membroId}/metas/${metaId}/`, dados);
    await mutate();
    return res.data as MetaMembro;
  };

  const deletarMeta = async (metaId: string): Promise<void> => {
    await api.delete(`/equipe/membros/${membroId}/metas/${metaId}/`);
    await mutate();
  };

  return {
    metas: resp?.data ?? [],
    isLoading,
    error,
    criarMeta,
    atualizarMeta,
    deletarMeta,
    mutate,
  };
}

// ─── Kanban da equipe ─────────────────────────────────────────────────────────

import type {
  ColunaKanban,
  ColunaFormData,
  KanbanConsolidado,
  TarefaPessoalFormData,
} from "@/types/equipe";

/** Board consolidado. Passe membroId para a visão individual; null = visão geral. */
export function useKanbanEquipe(membroId?: string | null) {
  const qs = membroId ? `?membro=${membroId}` : "";
  const { data: resp, error, isLoading, mutate } = useSWR<ApiResponse<KanbanConsolidado>>(
    `/equipe/kanban/${qs}`,
    (url: string) => api.get<KanbanConsolidado>(url)
  );
  return {
    kanban: (resp?.data as KanbanConsolidado | undefined) ?? { colunas: [] },
    isLoading,
    error,
    mutate,
  };
}

/** Colunas da empresa + CRUD/reordenar (admin). */
export function useColunasEquipe() {
  const { data: resp, isLoading, mutate } = useSWR<ApiResponse<ColunaKanban[]>>(
    "/equipe/kanban/colunas/",
    (url: string) => api.get<ColunaKanban[]>(url)
  );

  const criarColuna = async (dados: ColunaFormData) => {
    const res = await api.post<ColunaKanban>("/equipe/kanban/colunas/", dados);
    await mutate();
    return res.data as ColunaKanban;
  };

  const atualizarColuna = async (id: string, dados: Partial<ColunaFormData>) => {
    const res = await api.patch<ColunaKanban>(`/equipe/kanban/colunas/${id}/`, dados);
    await mutate();
    return res.data as ColunaKanban;
  };

  const excluirColuna = async (id: string, moverPara?: string) => {
    await api.delete(
      `/equipe/kanban/colunas/${id}/`,
      moverPara ? { mover_para: moverPara } : undefined
    );
    await mutate();
  };

  const reordenarColunas = async (ordens: { id: string; ordem: number }[]) => {
    await api.post("/equipe/kanban/colunas/reordenar/", ordens);
    await mutate();
  };

  return {
    colunas: (resp?.data as ColunaKanban[] | undefined) ?? [],
    isLoading,
    mutate,
    criarColuna,
    atualizarColuna,
    excluirColuna,
    reordenarColunas,
  };
}

// Tarefas pessoais — operações soltas (propagam erro para a UI dar feedback).
export async function criarTarefaPessoal(dados: TarefaPessoalFormData) {
  const res = await api.post("/equipe/tarefas/", dados);
  return res.data;
}

export async function editarTarefaPessoal(id: string, dados: Partial<TarefaPessoalFormData>) {
  const res = await api.patch(`/equipe/tarefas/${id}/`, dados);
  return res.data;
}

export async function apagarTarefaPessoal(id: string) {
  await api.delete(`/equipe/tarefas/${id}/`);
}

export async function moverTarefaPessoal(id: string, colunaId: string, ordemNaColuna: number) {
  const res = await api.post(`/equipe/tarefas/${id}/mover/`, {
    coluna_id: colunaId,
    ordem_na_coluna: ordemNaColuna,
  });
  return res.data;
}

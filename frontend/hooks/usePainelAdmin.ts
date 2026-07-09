/**
 * Synapse — hooks do Painel Administrativo (visão de plataforma).
 */
"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import type { ApiResponse, Pagination } from "@/types/api";
import type {
  EmpresaAdminDetail,
  EmpresaAdminList,
  LogAlteracaoPlano,
  Plano,
} from "@/types/painel_admin";

export function useEmpresasAdmin(page: number) {
  const { data, error, isLoading, mutate } = useSWR<
    ApiResponse<EmpresaAdminList[]>
  >(`/painel-admin/empresas/?page=${page}`, (url: string) =>
    api.get<EmpresaAdminList[]>(url)
  );
  return {
    empresas: data?.data ?? [],
    pagination: (data?.pagination as Pagination | undefined) ?? null,
    isLoading,
    error,
    mutate,
  };
}

export function useEmpresaAdmin(empresaId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<EmpresaAdminDetail>(
    empresaId ? `/painel-admin/empresas/${empresaId}/` : null,
    (url: string) =>
      api.get<EmpresaAdminDetail>(url).then((r) => r.data as EmpresaAdminDetail)
  );
  return { empresa: data ?? null, isLoading, error, mutate };
}

export function useHistoricoPlano(empresaId: string | null) {
  const { data, isLoading, mutate } = useSWR<ApiResponse<LogAlteracaoPlano[]>>(
    empresaId ? `/painel-admin/empresas/${empresaId}/historico/` : null,
    (url: string) => api.get<LogAlteracaoPlano[]>(url)
  );
  return {
    historico: data?.data ?? [],
    isLoading,
    mutate,
  };
}

/** Troca o plano de uma empresa. Propaga erro (rate limit, validação) ao caller. */
export async function trocarPlano(
  empresaId: string,
  plano_novo: Plano,
  observacao: string
): Promise<void> {
  await api.post(`/painel-admin/empresas/${empresaId}/trocar-plano/`, {
    plano_novo,
    observacao,
  });
}

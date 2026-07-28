/**
 * Synapse — hooks do Painel Administrativo (visão de plataforma).
 */
"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import type { ApiResponse, Pagination } from "@/types/api";
import type {
  CriarEmpresaPayload,
  EmpresaAdminDetail,
  EmpresaAdminList,
  FiltrosEmpresas,
  LogAlteracaoPlano,
  Plano,
  UsuarioAdmin,
} from "@/types/painel_admin";

/** Monta a querystring da lista a partir de página + filtros. */
function queryEmpresas(page: number, filtros: FiltrosEmpresas): string {
  const params = new URLSearchParams({ page: String(page) });
  if (filtros.busca) params.set("busca", filtros.busca);
  if (filtros.plano) params.set("plano", filtros.plano);
  // status "todas" não filtra (default do backend já é todas).
  if (filtros.status && filtros.status !== "todas")
    params.set("status", filtros.status);
  if (filtros.ordenar) params.set("ordenar", filtros.ordenar);
  return params.toString();
}

export function useEmpresasAdmin(page: number, filtros: FiltrosEmpresas = {}) {
  const qs = queryEmpresas(page, filtros);
  const { data, error, isLoading, mutate } = useSWR<
    ApiResponse<EmpresaAdminList[]>
  >(`/painel-admin/empresas/?${qs}`, (url: string) =>
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

/** Cria empresa + admin. Retorna a empresa criada. Propaga erros de validação. */
export async function criarEmpresa(
  payload: CriarEmpresaPayload
): Promise<EmpresaAdminDetail> {
  const res = await api.post<{ empresa: EmpresaAdminDetail; usuario: UsuarioAdmin }>(
    `/painel-admin/empresas/`,
    payload
  );
  return (res.data as { empresa: EmpresaAdminDetail }).empresa;
}

/** Edita nome e/ou segmento da empresa. */
export async function editarEmpresa(
  empresaId: string,
  dados: { nome?: string; segmento?: string }
): Promise<void> {
  await api.patch(`/painel-admin/empresas/${empresaId}/`, dados);
}

/** Suspende a empresa (motivo obrigatório, min 10 chars). */
export async function suspenderEmpresa(
  empresaId: string,
  motivo: string
): Promise<void> {
  await api.post(`/painel-admin/empresas/${empresaId}/suspender/`, { motivo });
}

/** Reativa a empresa (motivo opcional). */
export async function reativarEmpresa(
  empresaId: string,
  motivo = ""
): Promise<void> {
  await api.post(`/painel-admin/empresas/${empresaId}/reativar/`, { motivo });
}

/** Hard delete — só passa se suspensa há 30+ dias (validado no backend). */
export async function excluirEmpresa(empresaId: string): Promise<void> {
  await api.delete(`/painel-admin/empresas/${empresaId}/`);
}

/** Edita perfil e/ou is_active de um usuário da empresa. */
export async function editarUsuario(
  empresaId: string,
  usuarioId: string,
  dados: { perfil?: string; is_active?: boolean }
): Promise<void> {
  await api.patch(
    `/painel-admin/empresas/${empresaId}/usuarios/${usuarioId}/`,
    dados
  );
}

/** Redefine a senha do usuário e retorna a senha temporária gerada. */
export async function redefinirSenhaUsuario(
  empresaId: string,
  usuarioId: string
): Promise<string> {
  const res = await api.post<{ senha_temporaria: string }>(
    `/painel-admin/empresas/${empresaId}/usuarios/${usuarioId}/redefinir-senha/`,
    {}
  );
  return (res.data as { senha_temporaria: string }).senha_temporaria;
}

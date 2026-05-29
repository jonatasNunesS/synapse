// Synapse — M7: Hook do módulo Documentos
"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import type { Documento, DocumentoFormData, VersaoDocumento } from "@/types/documentos";
import type { ApiResponse } from "@/types/api";

const DOCS_KEY = "/documentos/";

// ── Lista de documentos ───────────────────────────────────
export function useDocumentos(params?: {
  tipo?: string;
  status?: string;
  busca?: string;
  tag?: string;
  page?: number;
}) {
  const query = new URLSearchParams();
  if (params?.tipo) query.set("tipo", params.tipo);
  if (params?.status) query.set("status", params.status);
  if (params?.busca) query.set("busca", params.busca);
  if (params?.tag) query.set("tag", params.tag);
  if (params?.page) query.set("page", String(params.page));
  const qs = query.toString();

  const { data: resp, error, isLoading, mutate } = useSWR<ApiResponse<Documento[]>>(
    `${DOCS_KEY}${qs ? `?${qs}` : ""}`,
    (url: string) => api.get<Documento[]>(url)
  );

  const criarDocumento = async (dados: DocumentoFormData): Promise<Documento> => {
    const res = await api.post<Documento>(DOCS_KEY, dados);
    await mutate();
    return res.data as Documento;
  };

  const atualizarDocumento = async (id: string, dados: Partial<DocumentoFormData>): Promise<Documento> => {
    const res = await api.patch<Documento>(`/documentos/${id}/`, dados);
    await mutate();
    return res.data as Documento;
  };

  const deletarDocumento = async (id: string): Promise<void> => {
    await api.delete(`/documentos/${id}/`);
    await mutate();
  };

  return {
    documentos: resp?.data ?? [],
    pagination: resp?.pagination,
    isLoading,
    error,
    criarDocumento,
    atualizarDocumento,
    deletarDocumento,
    mutate,
  };
}

// ── Detalhe de documento ──────────────────────────────────
export function useDocumento(id: string) {
  const { data: resp, error, isLoading, mutate } = useSWR<ApiResponse<Documento>>(
    id ? `/documentos/${id}/` : null,
    (url: string) => api.get<Documento>(url)
  );

  const criarVersao = async (notas: string): Promise<VersaoDocumento> => {
    const res = await api.post<VersaoDocumento>(`/documentos/${id}/versoes/`, { notas });
    await mutate();
    return res.data as VersaoDocumento;
  };

  return {
    documento: resp?.data,
    isLoading,
    error,
    criarVersao,
    mutate,
  };
}

// Synapse — M7: Hook do módulo Documentos
"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import type { Documento, DocumentoFormData, VersaoDocumento } from "@/types/documentos";

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

  const { data, error, isLoading, mutate } = useSWR(
    `${DOCS_KEY}${qs ? `?${qs}` : ""}`,
    (url: string) => api.get(url).then((r) => r.data)
  );

  const criarDocumento = async (dados: DocumentoFormData): Promise<Documento> => {
    const res = await api.post(DOCS_KEY, dados);
    await mutate();
    return res.data.data;
  };

  const atualizarDocumento = async (id: string, dados: Partial<DocumentoFormData>): Promise<Documento> => {
    const res = await api.patch(`/documentos/${id}/`, dados);
    await mutate();
    return res.data.data;
  };

  const deletarDocumento = async (id: string): Promise<void> => {
    await api.delete(`/documentos/${id}/`);
    await mutate();
  };

  return {
    documentos: (data?.data ?? []) as Documento[],
    pagination: data?.pagination,
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
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/documentos/${id}/` : null,
    (url: string) => api.get(url).then((r) => r.data)
  );

  const criarVersao = async (notas: string): Promise<VersaoDocumento> => {
    const res = await api.post(`/documentos/${id}/versoes/`, { notas });
    await mutate();
    return res.data.data;
  };

  return {
    documento: data?.data as Documento | undefined,
    isLoading,
    error,
    criarVersao,
    mutate,
  };
}

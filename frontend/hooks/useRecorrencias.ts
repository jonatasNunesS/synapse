/**
 * Synapse — hooks das Recorrências Inteligentes.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ApiError } from "@/types/api";
import type {
  Recorrencia,
  RecorrenciaFormData,
  OcorrenciaDetalhe,
} from "@/types/recorrencias";

// ── Central de recorrências ───────────────────────────────────────────────
export function useRecorrencias() {
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<Recorrencia[]>("/recorrencias/");
      setRecorrencias(resp.data);
    } catch (err: unknown) {
      setError((err as ApiError)?.error?.message ?? "Erro ao carregar recorrências.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criar = useCallback(async (dados: RecorrenciaFormData) => {
    await api.post("/recorrencias/", dados);
    await carregar();
  }, [carregar]);

  const atualizar = useCallback(
    async (id: string, dados: Partial<RecorrenciaFormData>) => {
      await api.patch(`/recorrencias/${id}/`, dados);
      await carregar();
    },
    [carregar]
  );

  const pausar = useCallback(async (id: string) => {
    await api.post(`/recorrencias/${id}/pausar/`);
    await carregar();
  }, [carregar]);

  const reativar = useCallback(async (id: string) => {
    await api.post(`/recorrencias/${id}/reativar/`);
    await carregar();
  }, [carregar]);

  const encerrar = useCallback(async (id: string) => {
    await api.delete(`/recorrencias/${id}/`);
    await carregar();
  }, [carregar]);

  return {
    recorrencias,
    loading,
    error,
    recarregar: carregar,
    criar,
    atualizar,
    pausar,
    reativar,
    encerrar,
  };
}

// ── Ações sobre uma ocorrência (modal de decisão do sino) ──────────────────
export async function obterOcorrencia(id: string): Promise<OcorrenciaDetalhe> {
  const resp = await api.get<OcorrenciaDetalhe>(`/recorrencias/ocorrencias/${id}/`);
  return resp.data as OcorrenciaDetalhe;
}

export async function confirmarOcorrencia(
  id: string,
  valor?: string,
  atualizarRecorrencia = false
): Promise<void> {
  await api.post(`/recorrencias/ocorrencias/${id}/confirmar/`, {
    valor: valor ?? null,
    atualizar_recorrencia: atualizarRecorrencia,
  });
}

export async function adiarOcorrencia(id: string, dias: number): Promise<void> {
  await api.post(`/recorrencias/ocorrencias/${id}/adiar/`, { dias });
}

export async function cancelarOcorrencia(id: string): Promise<void> {
  await api.post(`/recorrencias/ocorrencias/${id}/cancelar/`);
}

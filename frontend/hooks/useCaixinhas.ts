"use client";

/**
 * Synapse — Hook do módulo Caixinhas.
 * Operações de escrita propagam o erro (ApiError) para a UI dar feedback —
 * em especial SALDO_INSUFICIENTE, que carrega details.saldo_atual para o
 * modal de retirada oferecer "retirar tudo".
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ApiError } from "@/types/api";
import type {
  Caixinha,
  CaixinhaCreate,
  MovimentoCaixinha,
  ResumoCaixinhas,
} from "@/types/caixinhas";

export function useCaixinhas() {
  const [caixinhas, setCaixinhas] = useState<Caixinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<Caixinha[]>("/caixinhas/");
      if (resp.success && resp.data) {
        setCaixinhas(resp.data as unknown as Caixinha[]);
      }
    } catch (err: unknown) {
      const e = err as ApiError;
      setError(e?.error?.message ?? "Erro ao carregar caixinhas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criar = async (dados: CaixinhaCreate): Promise<Caixinha> => {
    const resp = await api.post<Caixinha>("/caixinhas/", dados);
    await carregar();
    return resp.data as Caixinha;
  };

  const atualizar = async (
    id: string,
    dados: Partial<CaixinhaCreate>
  ): Promise<Caixinha> => {
    const resp = await api.patch<Caixinha>(`/caixinhas/${id}/`, dados);
    await carregar();
    return resp.data as Caixinha;
  };

  const deletar = async (id: string): Promise<void> => {
    await api.delete(`/caixinhas/${id}/`);
    await carregar();
  };

  const depositar = async (
    id: string,
    valor: string,
    descricao?: string
  ): Promise<void> => {
    await api.post(`/caixinhas/${id}/depositar/`, { valor, descricao });
    await carregar();
  };

  const retirar = async (
    id: string,
    valor: string,
    descricao?: string
  ): Promise<void> => {
    await api.post(`/caixinhas/${id}/retirar/`, { valor, descricao });
    await carregar();
  };

  return {
    caixinhas,
    loading,
    error,
    recarregar: carregar,
    criar,
    atualizar,
    deletar,
    depositar,
    retirar,
  };
}

export function useMovimentosCaixinha() {
  const [movimentos, setMovimentos] = useState<MovimentoCaixinha[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async (caixinhaId: string) => {
    setLoading(true);
    try {
      const resp = await api.get<MovimentoCaixinha[]>(
        `/caixinhas/${caixinhaId}/movimentos/`
      );
      if (resp.success && resp.data) {
        setMovimentos(resp.data as unknown as MovimentoCaixinha[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return { movimentos, loading, carregar };
}

export function useResumoCaixinhas() {
  const [resumo, setResumo] = useState<ResumoCaixinhas | null>(null);

  const carregar = useCallback(async () => {
    const resp = await api.get<ResumoCaixinhas>("/caixinhas/resumo/");
    if (resp.success && resp.data) setResumo(resp.data);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { resumo, recarregar: carregar };
}

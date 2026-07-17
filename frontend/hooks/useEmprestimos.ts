"use client";

/**
 * Synapse — Hook de Empréstimos (tipo de lançamento no Financeiro).
 * Lista filtrável + operações quitar/adiar. Operações propagam erro à UI.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ApiError } from "@/types/api";
import type { Lancamento, ResumoEmprestimos } from "@/types/financeiro";

export type FiltroEmprestimo = "aberto" | "quitado" | "atrasado" | "todos";

export function useEmprestimos(filtroInicial: FiltroEmprestimo = "aberto") {
  const [emprestimos, setEmprestimos] = useState<Lancamento[]>([]);
  const [filtro, setFiltro] = useState<FiltroEmprestimo>(filtroInicial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<Lancamento[]>(
        `/financeiro/emprestimos/?filtro=${filtro}`
      );
      if (resp.success && resp.data) {
        setEmprestimos(resp.data as unknown as Lancamento[]);
      }
    } catch (err: unknown) {
      const e = err as ApiError;
      setError(e?.error?.message ?? "Erro ao carregar empréstimos.");
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const quitar = async (id: string, perdoar = false): Promise<void> => {
    await api.post(`/financeiro/lancamentos/${id}/quitar-emprestimo/`, { perdoar });
    await carregar();
  };

  const adiar = async (id: string, dias: number): Promise<void> => {
    await api.post(`/financeiro/lancamentos/${id}/adiar-emprestimo/`, { dias });
    await carregar();
  };

  return { emprestimos, filtro, setFiltro, loading, error, recarregar: carregar, quitar, adiar };
}

export function useResumoEmprestimos() {
  const [resumo, setResumo] = useState<ResumoEmprestimos | null>(null);

  const carregar = useCallback(async () => {
    const resp = await api.get<ResumoEmprestimos>("/financeiro/emprestimos/resumo/");
    if (resp.success && resp.data) setResumo(resp.data);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { resumo, recarregar: carregar };
}

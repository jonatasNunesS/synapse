"use client";

/**
 * Synapse — Hook do Módulo Financeiro
 * Gerencia estado, cache e operações CRUD do módulo financeiro.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ApiError } from "@/types/api";
import type {
  Categoria,
  CategoriaCreate,
  DRE,
  FiltrosLancamento,
  FluxoCaixaDia,
  Lancamento,
  LancamentoCreate,
  LancamentoPagar,
  LogEdicaoLancamento,
  ResumoFinanceiro,
  SaldoFinanceiro,
} from "@/types/financeiro";

// ── Resumo ────────────────────────────────────────────────

export function useResumoFinanceiro(mes?: number, ano?: number) {
  const hoje = new Date();
  const m = mes ?? hoje.getMonth() + 1;
  const a = ano ?? hoje.getFullYear();

  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<ResumoFinanceiro>(
        `/financeiro/resumo/?mes=${m}&ano=${a}`
      );
      setResumo(resp.data);
    } catch (err: unknown) {
      const e = err as ApiError;
      setError(e?.error?.message ?? "Erro ao carregar resumo.");
    } finally {
      setLoading(false);
    }
  }, [m, a]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { resumo, loading, error, recarregar: carregar };
}

// ── Saldo (acumulado + do mês) ────────────────────────────

export function useSaldoFinanceiro(mes?: number, ano?: number) {
  const hoje = new Date();
  const m = mes ?? hoje.getMonth() + 1;
  const a = ano ?? hoje.getFullYear();

  const [saldo, setSaldo] = useState<SaldoFinanceiro | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<SaldoFinanceiro>(
        `/financeiro/saldo/?mes=${m}&ano=${a}`
      );
      setSaldo(resp.data);
    } catch (err: unknown) {
      const e = err as ApiError;
      setError(e?.error?.message ?? "Erro ao carregar saldo.");
    } finally {
      setLoading(false);
    }
  }, [m, a]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { saldo, loading, error, recarregar: carregar };
}

// ── Fluxo de Caixa ────────────────────────────────────────

export function useFluxoCaixa(dataInicio?: string, dataFim?: string) {
  const hoje = new Date();
  const inicio =
    dataInicio ??
    new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toISOString()
      .split("T")[0];
  const fim = dataFim ?? hoje.toISOString().split("T")[0];

  const [fluxo, setFluxo] = useState<FluxoCaixaDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<FluxoCaixaDia[]>(
        `/financeiro/fluxo-caixa/?data_inicio=${inicio}&data_fim=${fim}`
      );
      setFluxo(resp.data);
    } catch (err: unknown) {
      const e = err as ApiError;
      setError(e?.error?.message ?? "Erro ao carregar fluxo.");
    } finally {
      setLoading(false);
    }
  }, [inicio, fim]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { fluxo, loading, error, recarregar: carregar };
}

// ── DRE ───────────────────────────────────────────────────

export function useDRE(mes?: number, ano?: number) {
  const hoje = new Date();
  const m = mes ?? hoje.getMonth() + 1;
  const a = ano ?? hoje.getFullYear();

  const [dre, setDre] = useState<DRE | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<DRE>(
        `/financeiro/dre/?mes=${m}&ano=${a}`
      );
      setDre(resp.data);
    } catch (err: unknown) {
      const e = err as ApiError;
      setError(e?.error?.message ?? "Erro ao carregar DRE.");
    } finally {
      setLoading(false);
    }
  }, [m, a]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { dre, loading, error, recarregar: carregar };
}

// ── Lançamentos ───────────────────────────────────────────

export function useLancamentos(filtros?: FiltrosLancamento) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtros?.tipo) params.set("tipo", filtros.tipo);
      if (filtros?.status) params.set("status", filtros.status);
      if (filtros?.categoria_id) params.set("categoria_id", filtros.categoria_id);
      if (filtros?.data_inicio) params.set("data_inicio", filtros.data_inicio);
      if (filtros?.data_fim) params.set("data_fim", filtros.data_fim);
      if (filtros?.busca) params.set("busca", filtros.busca);
      if (filtros?.page) params.set("page", String(filtros.page));

      const resp = await api.get<Lancamento[]>(
        `/financeiro/lancamentos/?${params.toString()}`
      );
      setLancamentos(resp.data);
      setTotal(resp.pagination?.count ?? 0);
    } catch (err: unknown) {
      const e = err as ApiError;
      setError(e?.error?.message ?? "Erro ao carregar lançamentos.");
    } finally {
      setLoading(false);
    }
  }, [
    filtros?.tipo,
    filtros?.status,
    filtros?.categoria_id,
    filtros?.data_inicio,
    filtros?.data_fim,
    filtros?.busca,
    filtros?.page,
  ]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criar = async (dados: LancamentoCreate): Promise<Lancamento> => {
    const resp = await api.post<Lancamento>(
      "/financeiro/lancamentos/",
      dados
    );
    await carregar();
    return resp.data;
  };

  // motivo: obrigatório quando o lançamento está PAGO (auditoria).
  const atualizar = async (
    id: string,
    dados: Partial<LancamentoCreate>,
    motivo?: string
  ): Promise<Lancamento> => {
    const resp = await api.patch<Lancamento>(
      `/financeiro/lancamentos/${id}/`,
      motivo ? { ...dados, motivo } : dados
    );
    await carregar();
    return resp.data;
  };

  const deletar = async (id: string): Promise<void> => {
    await api.delete(`/financeiro/lancamentos/${id}/`);
    await carregar();
  };

  // Exclusão auditada (lançamentos pagos): POST /excluir/ com motivo.
  const excluirAuditado = async (id: string, motivo: string): Promise<void> => {
    await api.post(`/financeiro/lancamentos/${id}/excluir/`, { motivo });
    await carregar();
  };

  const pagar = async (id: string, dados: LancamentoPagar): Promise<Lancamento> => {
    const resp = await api.post<Lancamento>(
      `/financeiro/lancamentos/${id}/pagar/`,
      dados
    );
    await carregar();
    return resp.data;
  };

  return {
    lancamentos,
    total,
    loading,
    error,
    recarregar: carregar,
    criar,
    atualizar,
    deletar,
    excluirAuditado,
    pagar,
  };
}

// ── Histórico de auditoria de um lançamento ───────────────

export function useHistoricoLancamento() {
  const [logs, setLogs] = useState<LogEdicaoLancamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async (lancamentoId: string) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<LogEdicaoLancamento[]>(
        `/financeiro/lancamentos/${lancamentoId}/historico/`
      );
      setLogs(resp.data ?? []);
    } catch (err: unknown) {
      const e = err as ApiError;
      setError(e?.error?.message ?? "Erro ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { logs, loading, error, carregar };
}

// ── Categorias ────────────────────────────────────────────

export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<Categoria[]>(
        "/financeiro/categorias/"
      );
      setCategorias(resp.data);
    } catch (err: unknown) {
      const e = err as ApiError;
      setError(e?.error?.message ?? "Erro ao carregar categorias.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criar = async (dados: CategoriaCreate): Promise<Categoria> => {
    try {
      const resp = await api.post<Categoria>(
        "/financeiro/categorias/",
        dados
      );
      return resp.data;
    } finally {
      await carregar();
    }
  };

  const atualizar = async (id: string, dados: Partial<CategoriaCreate>): Promise<Categoria> => {
    try {
      const resp = await api.patch<Categoria>(
        `/financeiro/categorias/${id}/`,
        dados
      );
      return resp.data;
    } finally {
      await carregar();
    }
  };

  const deletar = async (id: string): Promise<void> => {
    try {
      await api.delete(`/financeiro/categorias/${id}/`);
    } finally {
      await carregar();
    }
  };

  return { categorias, loading, error, recarregar: carregar, criar, atualizar, deletar };
}

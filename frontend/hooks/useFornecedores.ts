"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type {
  FornecedorList,
  FornecedorDetail,
  FornecedorFormData,
  AvaliacaoFormData,
  CompraFormData,
  CompraFornecedor,
  CategoriaFornecedor,
  RankingFornecedor,
  ResumoFornecedores,
} from "@/types/fornecedores";

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    count: number;
    next: string | null;
    previous: string | null;
    page_size: number;
  };
}

interface SingleResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ─── Resumo ─────────────────────────────────────────────────────────────────

export function useResumoFornecedores() {
  const [data, setData] = useState<ResumoFornecedores | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<SingleResponse<ResumoFornecedores>>(
        "/fornecedores/resumo/"
      );
      setData(res.data.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e?.response?.data?.error?.message ?? "Erro ao carregar resumo");
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetch };
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

export function useRankingFornecedores() {
  const [data, setData] = useState<RankingFornecedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedResponse<RankingFornecedor>>(
        "/fornecedores/ranking/"
      );
      setData(res.data.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e?.response?.data?.error?.message ?? "Erro ao carregar ranking");
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetch };
}

// ─── Categorias ──────────────────────────────────────────────────────────────

export function useCategoriasFornecedor() {
  const [data, setData] = useState<CategoriaFornecedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedResponse<CategoriaFornecedor>>(
        "/fornecedores/categorias/"
      );
      setData(res.data.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e?.response?.data?.error?.message ?? "Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  }, []);

  const criar = useCallback(
    async (payload: { nome: string; cor?: string }) => {
      const res = await api.post<SingleResponse<CategoriaFornecedor>>(
        "/fornecedores/categorias/",
        payload
      );
      return res.data.data;
    },
    []
  );

  return { data, loading, error, fetch, criar };
}

// ─── Fornecedores ─────────────────────────────────────────────────────────────

interface FornecedorFilters {
  search?: string;
  status?: string;
  categoria?: string;
  page?: number;
}

export function useFornecedores() {
  const [data, setData] = useState<FornecedorList[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (filters: FornecedorFilters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.categoria) params.set("categoria", filters.categoria);
      if (filters.page) params.set("page", String(filters.page));

      const url = `/fornecedores/?${params.toString()}`;
      const res = await api.get<PaginatedResponse<FornecedorList>>(url);
      setData(res.data.data);
      setTotal(res.data.pagination?.count ?? 0);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e?.response?.data?.error?.message ?? "Erro ao carregar fornecedores");
    } finally {
      setLoading(false);
    }
  }, []);

  const criar = useCallback(async (payload: FornecedorFormData) => {
    const res = await api.post<SingleResponse<FornecedorDetail>>(
      "/fornecedores/",
      payload
    );
    return res.data.data;
  }, []);

  return { data, total, loading, error, fetch, criar };
}

// ─── Fornecedor Detail ────────────────────────────────────────────────────────

export function useFornecedorDetail() {
  const [data, setData] = useState<FornecedorDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<SingleResponse<FornecedorDetail>>(
        `/fornecedores/${id}/`
      );
      setData(res.data.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e?.response?.data?.error?.message ?? "Erro ao carregar fornecedor");
    } finally {
      setLoading(false);
    }
  }, []);

  const atualizar = useCallback(
    async (id: string, payload: Partial<FornecedorFormData>) => {
      const res = await api.patch<SingleResponse<FornecedorDetail>>(
        `/fornecedores/${id}/`,
        payload
      );
      return res.data.data;
    },
    []
  );

  const remover = useCallback(async (id: string) => {
    await api.delete(`/fornecedores/${id}/`);
  }, []);

  const avaliar = useCallback(
    async (id: string, payload: AvaliacaoFormData) => {
      const res = await api.post<SingleResponse<FornecedorDetail>>(
        `/fornecedores/${id}/avaliar/`,
        payload
      );
      return res.data.data;
    },
    []
  );

  return { data, loading, error, fetch, atualizar, remover, avaliar };
}

// ─── Compras ─────────────────────────────────────────────────────────────────

export function useComprasFornecedor() {
  const [data, setData] = useState<CompraFornecedor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (fornecedorId: string, page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedResponse<CompraFornecedor>>(
        `/fornecedores/${fornecedorId}/compras/?page=${page}`
      );
      setData(res.data.data);
      setTotal(res.data.pagination?.count ?? 0);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e?.response?.data?.error?.message ?? "Erro ao carregar compras");
    } finally {
      setLoading(false);
    }
  }, []);

  const criar = useCallback(
    async (fornecedorId: string, payload: CompraFormData) => {
      const res = await api.post<SingleResponse<CompraFornecedor>>(
        `/fornecedores/${fornecedorId}/compras/`,
        payload
      );
      return res.data.data;
    },
    []
  );

  const atualizar = useCallback(
    async (compraId: string, payload: Partial<CompraFormData>) => {
      const res = await api.patch<SingleResponse<CompraFornecedor>>(
        `/fornecedores/compras/${compraId}/`,
        payload
      );
      return res.data.data;
    },
    []
  );

  const deletar = useCallback(async (compraId: string) => {
    await api.delete(`/fornecedores/compras/${compraId}/`);
  }, []);

  return { data, total, loading, error, fetch, criar, atualizar, deletar };
}

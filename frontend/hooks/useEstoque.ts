"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type {
  ProdutoList,
  ProdutoDetail,
  ProdutoCreate,
  CategoriaEstoque,
  CategoriaEstoqueCreate,
  Movimentacao,
  MovimentacaoCreate,
  ResumoEstoque,
  RelatorioEstoque,
  FiltrosProduto,
  FiltrosMovimentacao,
} from "@/types/estoque";
import type { PaginatedResponse } from "@/types/api";

// ─── Hook: Resumo do Estoque ──────────────────────────────────────────────────

export function useResumoEstoque() {
  const [resumo, setResumo] = useState<ResumoEstoque | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ResumoEstoque>("/estoque/resumo/");
      setResumo(res.data || null);
    } catch {
      setError("Erro ao carregar resumo do estoque.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { resumo, loading, error, carregar };
}

// ─── Hook: Alertas de Estoque ─────────────────────────────────────────────────

export function useAlertasEstoque() {
  const [alertas, setAlertas] = useState<ProdutoList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ProdutoList[]>("/estoque/alertas/");
      setAlertas(res.data || []);
    } catch {
      setError("Erro ao carregar alertas.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { alertas, loading, error, carregar };
}

// ─── Hook: Produtos ───────────────────────────────────────────────────────────

export function useProdutos() {
  const [produtos, setProdutos] = useState<ProdutoList[]>([]);
  const [paginacao, setPaginacao] = useState({
    total: 0,
    pagina: 1,
    totalPaginas: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listar = useCallback(async (filtros: FiltrosProduto = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtros.busca) params.set("busca", filtros.busca);
      if (filtros.categoria) params.set("categoria", filtros.categoria);
      if (filtros.status_estoque)
        params.set("status_estoque", filtros.status_estoque);
      if (filtros.ordering) params.set("ordering", filtros.ordering);
      if (filtros.page) params.set("page", String(filtros.page));

      const query = params.toString();
      const res = await api.get<ProdutoList[]>(
        `/estoque/produtos/${query ? `?${query}` : ""}`
      );
      setProdutos(res.data || []);
      setPaginacao({
        total: res.pagination?.count || 0,
        pagina: filtros.page || 1,
        totalPaginas: res.pagination?.total_pages || 1,
      });
    } catch {
      setError("Erro ao carregar produtos.");
    } finally {
      setLoading(false);
    }
  }, []);

  const obter = useCallback(async (id: string): Promise<ProdutoDetail | null> => {
    try {
      const res = await api.get<ProdutoDetail>(`/estoque/produtos/${id}/`);
      return res.data || null;
    } catch {
      return null;
    }
  }, []);

  const criar = useCallback(async (dados: ProdutoCreate): Promise<ProdutoDetail | null> => {
    try {
      const res = await api.post<ProdutoDetail>("/estoque/produtos/", dados);
      return res.data || null;
    } catch {
      return null;
    }
  }, []);

  const atualizar = useCallback(
    async (id: string, dados: Partial<ProdutoCreate>): Promise<ProdutoDetail | null> => {
      try {
        const res = await api.patch<ProdutoDetail>(
          `/estoque/produtos/${id}/`,
          dados
        );
        return res.data || null;
      } catch {
        return null;
      }
    },
    []
  );

  const excluir = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/estoque/produtos/${id}/`);
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    produtos,
    paginacao,
    loading,
    error,
    listar,
    obter,
    criar,
    atualizar,
    excluir,
  };
}

// ─── Hook: Movimentações ──────────────────────────────────────────────────────

export function useMovimentacoes() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [paginacao, setPaginacao] = useState({
    total: 0,
    pagina: 1,
    totalPaginas: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listar = useCallback(
    async (produtoId: string, filtros: FiltrosMovimentacao = {}) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filtros.tipo) params.set("tipo", filtros.tipo);
        if (filtros.motivo) params.set("motivo", filtros.motivo);
        if (filtros.data_inicio) params.set("data_inicio", filtros.data_inicio);
        if (filtros.data_fim) params.set("data_fim", filtros.data_fim);
        if (filtros.page) params.set("page", String(filtros.page));

        const query = params.toString();
        const res = await api.get<Movimentacao[]>(
          `/estoque/produtos/${produtoId}/movimentacoes/${query ? `?${query}` : ""}`
        );
        setMovimentacoes(res.data || []);
        setPaginacao({
          total: res.pagination?.count || 0,
          pagina: filtros.page || 1,
          totalPaginas: res.pagination?.total_pages || 1,
        });
      } catch {
        setError("Erro ao carregar movimentações.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const registrar = useCallback(
    async (dados: MovimentacaoCreate): Promise<Movimentacao | null> => {
      try {
        const res = await api.post<Movimentacao>(
          "/estoque/movimentacoes/",
          dados
        );
        return res.data || null;
      } catch {
        return null;
      }
    },
    []
  );

  return { movimentacoes, paginacao, loading, error, listar, registrar };
}

// ─── Hook: Categorias de Estoque ──────────────────────────────────────────────

export function useCategoriasEstoque() {
  const [categorias, setCategorias] = useState<CategoriaEstoque[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<CategoriaEstoque[]>("/estoque/categorias/");
      setCategorias(res.data || []);
    } catch {
      setError("Erro ao carregar categorias.");
    } finally {
      setLoading(false);
    }
  }, []);

  const criar = useCallback(
    async (dados: CategoriaEstoqueCreate): Promise<CategoriaEstoque | null> => {
      try {
        const res = await api.post<CategoriaEstoque>(
          "/estoque/categorias/",
          dados
        );
        return res.data || null;
      } catch {
        return null;
      }
    },
    []
  );

  const atualizar = useCallback(
    async (id: string, dados: Partial<CategoriaEstoqueCreate>): Promise<CategoriaEstoque | null> => {
      try {
        const res = await api.patch<CategoriaEstoque>(
          `/estoque/categorias/${id}/`,
          dados
        );
        return res.data || null;
      } catch {
        return null;
      }
    },
    []
  );

  const excluir = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/estoque/categorias/${id}/`);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { categorias, loading, error, listar, criar, atualizar, excluir };
}

// ─── Hook: Relatório de Estoque ───────────────────────────────────────────────

export function useRelatorioEstoque() {
  const [relatorio, setRelatorio] = useState<RelatorioEstoque | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<RelatorioEstoque>("/estoque/relatorio/");
      setRelatorio(res.data || null);
    } catch {
      setError("Erro ao carregar relatório.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { relatorio, loading, error, carregar };
}

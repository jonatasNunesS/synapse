"use client";

/**
 * Synapse — Estoque: hooks de dados.
 *
 * Toda leitura aqui segue o mesmo contrato, e ele mudou na Leva 4:
 *
 *   catch (err) → setError(getErrorMessage(err)) → throw err
 *
 * Os três passos importam por razões diferentes. O BINDING guarda o erro em
 * vez de descartá-lo. O `getErrorMessage` põe a mensagem do backend no lugar
 * de "Erro ao carregar produtos." — a mensagem fixa é a mesma quer o problema
 * seja permissão, filtro inválido ou banco fora do ar, e quem lê não fica
 * sabendo de nada. E o THROW é o que faz a mensagem chegar à tela: o `error`
 * do hook sozinho não resolvia, porque nenhuma página destas lia esse campo —
 * ele era escrito e nunca renderizado. Quem chama agora recebe a rejeição e
 * mostra o toast, como o resto do sistema já fazia nas escritas.
 */

import { useState, useCallback } from "react";
import { api, getErrorMessage } from "@/lib/api";
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
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
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
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
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
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Um produto pelo id.
   *
   * Devolvia `null` tanto para "não existe" quanto para "a consulta falhou", e
   * a tela de detalhe mostrava "Produto não encontrado" nos dois casos — uma
   * afirmação sobre o banco que ninguém tinha como fazer. Agora `null` é só o
   * 404, e a falha propaga.
   */
  const obter = useCallback(async (id: string): Promise<ProdutoDetail | null> => {
    const res = await api.get<ProdutoDetail>(`/estoque/produtos/${id}/`);
    return res.data || null;
  }, []);

  // Operações de escrita propagam o erro (ApiError) para a UI dar feedback —
  // o padrão anterior catch { return null } fazia falhas passarem caladas.
  const criar = useCallback(async (dados: ProdutoCreate): Promise<ProdutoDetail> => {
    const res = await api.post<ProdutoDetail>("/estoque/produtos/", dados);
    return res.data as ProdutoDetail;
  }, []);

  const atualizar = useCallback(
    async (id: string, dados: Partial<ProdutoCreate>): Promise<ProdutoDetail> => {
      const res = await api.patch<ProdutoDetail>(
        `/estoque/produtos/${id}/`,
        dados
      );
      return res.data as ProdutoDetail;
    },
    []
  );

  const excluir = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/estoque/produtos/${id}/`);
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
      } catch (err) {
        setError(getErrorMessage(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Propaga o erro (ApiError) para a UI dar feedback
  const registrar = useCallback(
    async (dados: MovimentacaoCreate): Promise<Movimentacao> => {
      const res = await api.post<Movimentacao>(
        "/estoque/movimentacoes/",
        dados
      );
      return res.data as Movimentacao;
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
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const criar = useCallback(
    async (dados: CategoriaEstoqueCreate): Promise<CategoriaEstoque> => {
      // Item 2 fix: erro propaga para o modal + recarrega lista após sucesso
      const res = await api.post<CategoriaEstoque>("/estoque/categorias/", dados);
      await listar();
      return res.data;
    },
    [listar]
  );

  const atualizar = useCallback(
    async (id: string, dados: Partial<CategoriaEstoqueCreate>): Promise<CategoriaEstoque> => {
      // Item 2 fix: erro propaga para o modal + recarrega lista após sucesso
      const res = await api.patch<CategoriaEstoque>(`/estoque/categorias/${id}/`, dados);
      await listar();
      return res.data;
    },
    [listar]
  );

  const excluir = useCallback(async (id: string): Promise<void> => {
    // Item 2 fix: erro propaga para o modal + recarrega lista após sucesso
    await api.delete(`/estoque/categorias/${id}/`);
    await listar();
  }, [listar]);

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
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { relatorio, loading, error, carregar };
}

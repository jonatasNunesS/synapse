"use client";
/**
 * Synapse — Categorias de evento da Agenda.
 *
 * A lista ATIVA é o que o formulário de evento e a legenda usam. A gestão pede
 * `?inativas=1` para poder religar o que foi desligado.
 *
 * Erros propagam para o caller tratar, como no resto do módulo.
 */
import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import type { CategoriaEvento, CategoriaEventoPayload } from "@/types/agenda";

export function useCategoriasAgenda(incluirInativas = false) {
  const [categorias, setCategorias] = useState<CategoriaEvento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<CategoriaEvento[]>(
        "/agenda/categorias/",
        incluirInativas ? { inativas: 1 } : undefined
      );
      const lista = (resp.data as unknown as CategoriaEvento[]) ?? [];
      setCategorias(lista);
      return lista;
    } catch (err) {
      setError("Não foi possível carregar as categorias.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [incluirInativas]);

  const criar = useCallback(
    async (payload: CategoriaEventoPayload): Promise<CategoriaEvento> => {
      const resp = await api.post<CategoriaEvento>("/agenda/categorias/", payload);
      return resp.data as CategoriaEvento;
    },
    []
  );

  const atualizar = useCallback(
    async (
      id: string,
      payload: Partial<CategoriaEventoPayload>
    ): Promise<CategoriaEvento> => {
      const resp = await api.patch<CategoriaEvento>(
        `/agenda/categorias/${id}/`,
        payload
      );
      return resp.data as CategoriaEvento;
    },
    []
  );

  /**
   * Liga/desliga. Não existe excluir: desligar oculta e preserva a cor dos
   * eventos históricos, que é a filosofia do resto do sistema.
   */
  const definirAtivo = useCallback(
    (id: string, ativo: boolean) => atualizar(id, { ativo }),
    [atualizar]
  );

  return {
    categorias,
    loading,
    error,
    carregar,
    criar,
    atualizar,
    definirAtivo,
  };
}

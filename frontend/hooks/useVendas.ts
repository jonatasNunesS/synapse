"use client";

/**
 * Synapse — Hook do módulo Vendas (fase 1).
 *
 * As operações de escrita propagam o erro para a tela mostrar a mensagem real
 * do backend — em especial a recusa de desconto maior que o subtotal, que a
 * pessoa precisa entender para corrigir.
 */
import { useCallback, useEffect, useState } from "react";

import { api, getErrorMessage } from "@/lib/api";
import type { Venda, VendaPayload } from "@/types/vendas";

export function useVendas() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<Venda[]>("/vendas/");
      setVendas((resp.data as unknown as Venda[]) ?? []);
      setTotal(resp.pagination?.count ?? 0);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criar = useCallback(
    async (dados: VendaPayload): Promise<Venda> => {
      const resp = await api.post<Venda>("/vendas/", dados);
      await carregar();
      return resp.data;
    },
    [carregar]
  );

  const atualizar = useCallback(
    async (id: string, dados: VendaPayload): Promise<Venda> => {
      const resp = await api.patch<Venda>(`/vendas/${id}/`, dados);
      await carregar();
      return resp.data;
    },
    [carregar]
  );

  const deletar = useCallback(
    async (id: string): Promise<void> => {
      await api.delete(`/vendas/${id}/`);
      await carregar();
    },
    [carregar]
  );

  return { vendas, total, loading, error, recarregar: carregar, criar, atualizar, deletar };
}

/** Detalhe de uma venda, com os itens. */
export function useVenda(id: string | null) {
  const [venda, setVenda] = useState<Venda | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setVenda(null);
      return;
    }
    let cancelado = false;
    setLoading(true);
    api
      .get<Venda>(`/vendas/${id}/`)
      .then((resp) => {
        if (!cancelado) setVenda(resp.data);
      })
      .catch(() => {
        if (!cancelado) setVenda(null);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  return { venda, loading };
}

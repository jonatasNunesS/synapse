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
import type { PreviaEstoque, Venda, VendaPayload } from "@/types/vendas";

/**
 * As duas integrações da venda: estoque e financeiro.
 *
 * Nenhuma das duas acontece sozinha — quem chama é a tela, depois de a pessoa
 * confirmar. O erro do backend sobe intacto: "já baixou", "já lançado" e
 * "estoque insuficiente" são recusas que ela precisa ler para decidir.
 */
export const vendaIntegracoes = {
  /** O que a baixa faria, sem fazer. */
  previaEstoque: (id: string) =>
    api.get<PreviaEstoque>(`/vendas/${id}/estoque/`).then((r) => r.data),

  /** `parcial` responde ao aviso de estoque insuficiente: baixa o que há. */
  baixarEstoque: (id: string, parcial = false) =>
    api.post<Venda>(`/vendas/${id}/estoque/`, { parcial }).then((r) => r.data),

  lancarFinanceiro: (id: string) =>
    api.post<Venda>(`/vendas/${id}/financeiro/`, {}).then((r) => r.data),
};

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

/**
 * As vendas de um cliente, para o histórico dele.
 *
 * Sem isso a Venda não tem por onde chegar na timeline: até aqui a tela do
 * cliente lia só as interações, e uma venda registrada em Vendas simplesmente
 * não aparecia no histórico de quem comprou.
 *
 * Não há risco de a mesma compra aparecer duas vezes: o backend já tira da
 * lista de interações aquelas que a migração da fase 2 converteu em Venda.
 */
export function useVendasDoCliente(clienteId: string | null) {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    if (!clienteId) {
      setVendas([]);
      return;
    }
    setLoading(true);
    try {
      const resp = await api.get<Venda[]>(`/vendas/?cliente_id=${clienteId}`);
      setVendas((resp.data as unknown as Venda[]) ?? []);
    } catch {
      // O histórico não some por causa das vendas: as interações continuam
      // aparecendo, e uma lista vazia é melhor do que a tela toda em branco.
      setVendas([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { vendas, loading, recarregar: carregar };
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

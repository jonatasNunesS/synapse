"use client";

import { useState, useCallback } from "react";
import api from "@/lib/api";

export interface Caixinha {
  id: string;
  nome: string;
  descricao: string;
  cor: string;
  icone: string;
  meta: number | null;
  saldo_atual: number;
  data_meta: string | null;
  ativa: boolean;
  progresso: number;
  criado_em: string;
  atualizado_em: string;
}

export interface MovimentoCaixinha {
  id: string;
  tipo: "deposito" | "retirada";
  valor: number;
  descricao: string;
  saldo_anterior: number;
  saldo_posterior: number;
  criado_em: string;
}

export interface CaixinhaFormData {
  nome: string;
  descricao?: string;
  cor?: string;
  icone?: string;
  meta?: number | null;
  data_meta?: string | null;
}

export function useCaixinhas() {
  const [caixinhas, setCaixinhas] = useState<Caixinha[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Caixinha[] }>("/financeiro/caixinhas/");
      setCaixinhas(res.data?.data || []);
    } catch {
      setError("Erro ao carregar caixinhas.");
    } finally {
      setLoading(false);
    }
  }, []);

  const criar = useCallback(async (dados: CaixinhaFormData): Promise<Caixinha | null> => {
    try {
      const res = await api.post<{ data: Caixinha }>("/financeiro/caixinhas/", dados);
      const nova = res.data?.data;
      if (nova) setCaixinhas((prev) => [nova, ...prev]);
      return nova || null;
    } catch {
      return null;
    }
  }, []);

  const atualizar = useCallback(async (id: string, dados: Partial<CaixinhaFormData>): Promise<Caixinha | null> => {
    try {
      const res = await api.patch<{ data: Caixinha }>(`/financeiro/caixinhas/${id}/`, dados);
      const atualizada = res.data?.data;
      if (atualizada) {
        setCaixinhas((prev) => prev.map((c) => (c.id === id ? atualizada : c)));
      }
      return atualizada || null;
    } catch {
      return null;
    }
  }, []);

  const deletar = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/financeiro/caixinhas/${id}/`);
      setCaixinhas((prev) => prev.filter((c) => c.id !== id));
      return true;
    } catch {
      return false;
    }
  }, []);

  const movimentar = useCallback(async (
    id: string,
    tipo: "deposito" | "retirada",
    valor: number,
    descricao?: string
  ): Promise<{ movimento: MovimentoCaixinha; caixinha: Caixinha } | null> => {
    try {
      const res = await api.post<{ data: { movimento: MovimentoCaixinha; caixinha: Caixinha } }>(
        `/financeiro/caixinhas/${id}/movimentar/`,
        { tipo, valor, descricao: descricao || "" }
      );
      const resultado = res.data?.data;
      if (resultado?.caixinha) {
        setCaixinhas((prev) => prev.map((c) => (c.id === id ? resultado.caixinha : c)));
      }
      return resultado || null;
    } catch {
      return null;
    }
  }, []);

  return { caixinhas, loading, error, carregar, criar, atualizar, deletar, movimentar };
}

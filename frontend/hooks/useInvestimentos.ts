"use client";

import { useState, useCallback } from "react";
import api from "@/lib/api";

export interface Investimento {
  id: string;
  nome: string;
  descricao: string;
  tipo: string;
  cor: string;
  valor_inicial: number;
  valor_atual: number;
  taxa_juros_anual: number | null;
  data_inicio: string;
  data_vencimento: string | null;
  ativo: boolean;
  rentabilidade: number;
  ganho_absoluto: number;
  criado_em: string;
}

export interface ResumoInvestimentos {
  total_investido: number;
  total_atual: number;
  ganho_total: number;
  rentabilidade_geral: number;
}

export interface InvestimentoFormData {
  nome: string;
  descricao?: string;
  tipo?: string;
  cor?: string;
  valor_inicial: number;
  valor_atual?: number;
  taxa_juros_anual?: number | null;
  data_inicio: string;
  data_vencimento?: string | null;
}

export const TIPO_INVESTIMENTO_LABELS: Record<string, string> = {
  renda_fixa: "Renda Fixa",
  renda_variavel: "Renda Variável",
  fundos: "Fundos",
  criptomoeda: "Criptomoeda",
  imovel: "Imóvel",
  outro: "Outro",
};

export function useInvestimentos() {
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [resumo, setResumo] = useState<ResumoInvestimentos | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: { investimentos: Investimento[]; resumo: ResumoInvestimentos } }>(
        "/financeiro/investimentos/"
      );
      setInvestimentos(res.data?.data?.investimentos || []);
      setResumo(res.data?.data?.resumo || null);
    } catch {
      setError("Erro ao carregar investimentos.");
    } finally {
      setLoading(false);
    }
  }, []);

  const criar = useCallback(async (dados: InvestimentoFormData): Promise<Investimento | null> => {
    try {
      const res = await api.post<{ data: Investimento }>("/financeiro/investimentos/", dados);
      const novo = res.data?.data;
      if (novo) {
        setInvestimentos((prev) => [novo, ...prev]);
        await carregar(); // refresh resumo
      }
      return novo || null;
    } catch {
      return null;
    }
  }, [carregar]);

  const atualizar = useCallback(async (id: string, dados: Partial<InvestimentoFormData>): Promise<Investimento | null> => {
    try {
      const res = await api.patch<{ data: Investimento }>(`/financeiro/investimentos/${id}/`, dados);
      const atualizado = res.data?.data;
      if (atualizado) {
        setInvestimentos((prev) => prev.map((i) => (i.id === id ? atualizado : i)));
        await carregar();
      }
      return atualizado || null;
    } catch {
      return null;
    }
  }, [carregar]);

  const deletar = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/financeiro/investimentos/${id}/`);
      setInvestimentos((prev) => prev.filter((i) => i.id !== id));
      await carregar();
      return true;
    } catch {
      return false;
    }
  }, [carregar]);

  return { investimentos, resumo, loading, error, carregar, criar, atualizar, deletar };
}

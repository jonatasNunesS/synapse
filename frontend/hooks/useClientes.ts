"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type {
  ClienteList,
  ClienteDetail,
  ClienteCreate,
  InteracaoCliente,
  InteracaoCreate,
  FunilData,
  ResumoClientes,
  StatusFunil,
} from "@/types/clientes";
import type { ApiResponse, PaginatedResponse } from "@/types/api";

// ─── Filtros ─────────────────────────────────────────────────────────────────

export interface FiltrosClientes {
  status_funil?: string;
  origem?: string;
  ativo?: string;
  busca?: string;
  tags?: string;
  followup_atrasado?: string;
  page?: number;
}

// ─── Hook principal de listagem ───────────────────────────────────────────────

export function useClientes() {
  const [clientes, setClientes] = useState<ClienteList[]>([]);
  const [pagination, setPagination] = useState({ count: 0, next: null, previous: null, page: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async (filtros: FiltrosClientes = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => {
        if (v !== undefined && v !== "") params.append(k, String(v));
      });
      const resp = await api.get<PaginatedResponse<ClienteList>>(
        `/clientes/?${params.toString()}`
      );
      if (resp.success && resp.data) {
        setClientes(resp.data as unknown as ClienteList[]);
        if (resp.pagination) setPagination(resp.pagination as typeof pagination);
      }
    } catch {
      setError("Erro ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  const criar = useCallback(async (dados: ClienteCreate): Promise<ClienteDetail | null> => {
    try {
      const resp = await api.post<ClienteDetail>("/clientes/", dados);
      if (resp.success && resp.data) return resp.data;
      return null;
    } catch {
      return null;
    }
  }, []);

  const atualizar = useCallback(
    async (id: string, dados: Partial<ClienteCreate>): Promise<ClienteDetail | null> => {
      try {
        const resp = await api.patch<ClienteDetail>(`/clientes/${id}/`, dados);
        if (resp.success && resp.data) return resp.data;
        return null;
      } catch {
        return null;
      }
    },
    []
  );

  const deletar = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/clientes/${id}/`);
      return true;
    } catch {
      return false;
    }
  }, []);

  const moverFunil = useCallback(
    async (id: string, status_funil: StatusFunil): Promise<ClienteDetail | null> => {
      try {
        const resp = await api.patch<ClienteDetail>(`/clientes/${id}/mover-funil/`, {
          status_funil,
        });
        if (resp.success && resp.data) return resp.data;
        return null;
      } catch {
        return null;
      }
    },
    []
  );

  return { clientes, pagination, loading, error, carregar, criar, atualizar, deletar, moverFunil };
}

// ─── Hook de detalhe do cliente ───────────────────────────────────────────────

export function useClienteDetalhe(id: string) {
  const [cliente, setCliente] = useState<ClienteDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<ClienteDetail>(`/clientes/${id}/`);
      if (resp.success && resp.data) setCliente(resp.data);
    } catch {
      setError("Erro ao carregar cliente.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  return { cliente, loading, error, carregar, setCliente };
}

// ─── Hook do funil Kanban ─────────────────────────────────────────────────────

export function useFunilKanban() {
  const [funil, setFunil] = useState<FunilData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<FunilData>("/clientes/funil/");
      if (resp.success && resp.data) setFunil(resp.data);
    } catch {
      setError("Erro ao carregar funil.");
    } finally {
      setLoading(false);
    }
  }, []);

  const moverCard = useCallback(
    async (clienteId: string, novoStatus: StatusFunil) => {
      if (!funil) return;

      // Otimistic update: move o card localmente antes da API responder
      const statusAtual = (Object.keys(funil) as StatusFunil[]).find((status) =>
        funil[status]?.some?.((c: ClienteList) => c.id === clienteId)
      );

      if (!statusAtual || statusAtual === novoStatus) return;

      const clienteMovido = funil[statusAtual]?.find?.((c: ClienteList) => c.id === clienteId);
      if (!clienteMovido) return;

      const novoFunil = { ...funil };
      novoFunil[statusAtual] = funil[statusAtual].filter((c: ClienteList) => c.id !== clienteId);
      novoFunil[novoStatus] = [
        ...funil[novoStatus],
        { ...clienteMovido, status_funil: novoStatus },
      ];
      setFunil(novoFunil);

      // Chama API
      try {
        await api.patch(`/clientes/${clienteId}/mover-funil/`, { status_funil: novoStatus });
      } catch {
        // Reverte em caso de erro
        setFunil(funil);
      }
    },
    [funil]
  );

  return { funil, loading, error, carregar, moverCard };
}

// ─── Hook de resumo / KPIs ────────────────────────────────────────────────────

export function useResumoClientes() {
  const [resumo, setResumo] = useState<ResumoClientes | null>(null);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await api.get<ResumoClientes>("/clientes/resumo/");
      if (resp.success && resp.data) setResumo(resp.data);
    } finally {
      setLoading(false);
    }
  }, []);

  return { resumo, loading, carregar };
}

// ─── Hook de interações ───────────────────────────────────────────────────────

export function useInteracoes(clienteId: string) {
  const [interacoes, setInteracoes] = useState<InteracaoCliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<ApiResponse<InteracaoCliente[]>>(
        `/clientes/${clienteId}/interacoes/`
      );
      if (resp.success && resp.data) {
        setInteracoes(resp.data as unknown as InteracaoCliente[]);
      }
    } catch {
      setError("Erro ao carregar interações.");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  const registrar = useCallback(
    async (dados: InteracaoCreate): Promise<InteracaoCliente | null> => {
      try {
        const resp = await api.post<InteracaoCliente>(
          `/clientes/${clienteId}/interacoes/`,
          dados
        );
        if (resp.success && resp.data) {
          setInteracoes((prev) => [resp.data!, ...prev]);
          return resp.data;
        }
        return null;
      } catch {
        return null;
      }
    },
    [clienteId]
  );

  return { interacoes, loading, error, carregar, registrar };
}

// ─── Hook de follow-ups ───────────────────────────────────────────────────────

export function useFollowups() {
  const [followups, setFollowups] = useState<ClienteList[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async (dias = 3) => {
    setLoading(true);
    try {
      const resp = await api.get<ClienteList[]>(`/clientes/followups/?dias=${dias}`);
      if (resp.success && resp.data) setFollowups(resp.data as unknown as ClienteList[]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { followups, loading, carregar };
}

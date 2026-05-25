"use client";
/**
 * Synapse — M6: Hooks do Módulo Projetos e Tarefas
 * Gerencia estado, cache e operações CRUD do módulo de projetos.
 */
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api";
import type { PaginatedResponse } from "@/types/api";
import type {
  ChecklistItem,
  Comentario,
  KanbanData,
  ProjetoCreatePayload,
  ProjetoDetail,
  ProjetoList,
  ResumoProjetosData,
  TarefaCreatePayload,
  TarefaDetail,
  TarefaList,
  TarefaMoverPayload,
} from "@/types/projetos";

// ── Resumo ────────────────────────────────────────────────
// BAIXO-1: corrigido typo "useResumoProjetoss" → "useResumoProjetoS"

export function useResumoProjetoS() {
  const [resumo, setResumo] = useState<ResumoProjetosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // MÉDIO-12: padrão correto — api.get<T> → resp.data = T
      const resp = await api.get<ResumoProjetosData>("/projetos/resumo/");
      setResumo(resp.data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { resumo, loading, error, recarregar: carregar };
}

// ── Lista de Projetos ─────────────────────────────────────

export function useProjetos(filtros?: Record<string, string>) {
  const [projetos, setProjetos] = useState<ProjetoList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(filtros ?? {});
      const resp = await api.get<PaginatedResponse<ProjetoList>>(
        `/projetos/?${params.toString()}`
      );
      // MÉDIO-11: guard antes de acessar .data e .pagination
      setProjetos(resp.data?.data ?? []);
      setTotal(resp.data?.pagination?.count ?? 0);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filtros)]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criar = useCallback(async (dados: ProjetoCreatePayload) => {
    const resp = await api.post<ProjetoDetail>("/projetos/", dados);
    await carregar();
    return resp.data;
  }, [carregar]);

  const atualizar = useCallback(
    async (id: string, dados: Partial<ProjetoCreatePayload>) => {
      const resp = await api.patch<ProjetoDetail>(`/projetos/${id}/`, dados);
      await carregar();
      return resp.data;
    },
    [carregar]
  );

  const deletar = useCallback(
    async (id: string) => {
      await api.delete(`/projetos/${id}/`);
      await carregar();
    },
    [carregar]
  );

  return { projetos, loading, error, total, recarregar: carregar, criar, atualizar, deletar };
}

// ── Detalhe do Projeto ────────────────────────────────────

export function useProjetoDetalhe(id: string | null) {
  const [projeto, setProjeto] = useState<ProjetoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    // MÉDIO-11: guard — não chamar API sem id
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<ProjetoDetail>(`/projetos/${id}/`);
      setProjeto(resp.data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { projeto, loading, error, recarregar: carregar };
}

// ── Kanban ────────────────────────────────────────────────

export function useKanban(projetoId: string | null) {
  const [kanban, setKanban] = useState<KanbanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    // MÉDIO-11: guard
    if (!projetoId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<KanbanData>(`/projetos/${projetoId}/kanban/`);
      setKanban(resp.data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [projetoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const moverTarefa = useCallback(
    async (tarefaId: string, payload: TarefaMoverPayload) => {
      const resp = await api.patch<TarefaList>(
        `/projetos/tarefas/${tarefaId}/mover/`,
        payload
      );
      await carregar();
      return resp.data;
    },
    [carregar]
  );

  return { kanban, loading, error, recarregar: carregar, moverTarefa };
}

// ── Tarefas ───────────────────────────────────────────────

export function useTarefas(projetoId: string | null) {
  const [tarefas, setTarefas] = useState<TarefaList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    // MÉDIO-11: guard
    if (!projetoId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<PaginatedResponse<TarefaList>>(
        `/projetos/${projetoId}/tarefas/`
      );
      setTarefas(resp.data?.data ?? []);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [projetoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criar = useCallback(
    async (dados: TarefaCreatePayload) => {
      const resp = await api.post<TarefaDetail>(
        `/projetos/${projetoId}/tarefas/`,
        dados
      );
      await carregar();
      return resp.data;
    },
    [projetoId, carregar]
  );

  const atualizar = useCallback(
    async (tarefaId: string, dados: Partial<TarefaCreatePayload>) => {
      const resp = await api.patch<TarefaDetail>(
        `/projetos/tarefas/${tarefaId}/`,
        dados
      );
      await carregar();
      return resp.data;
    },
    [carregar]
  );

  const deletar = useCallback(
    async (tarefaId: string) => {
      await api.delete(`/projetos/tarefas/${tarefaId}/`);
      await carregar();
    },
    [carregar]
  );

  return { tarefas, loading, error, recarregar: carregar, criar, atualizar, deletar };
}

// ── Tarefa Detalhe ────────────────────────────────────────

export function useTarefaDetalhe(tarefaId: string | null) {
  const [tarefa, setTarefa] = useState<TarefaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    // MÉDIO-11: guard
    if (!tarefaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<TarefaDetail>(`/projetos/tarefas/${tarefaId}/`);
      setTarefa(resp.data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tarefaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { tarefa, loading, error, recarregar: carregar };
}

// ── Comentários ───────────────────────────────────────────

export function useComentarios(tarefaId: string | null) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    // MÉDIO-11: guard
    if (!tarefaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<PaginatedResponse<Comentario>>(
        `/projetos/tarefas/${tarefaId}/comentarios/`
      );
      setComentarios(resp.data?.data ?? []);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tarefaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const adicionar = useCallback(
    async (texto: string) => {
      const resp = await api.post<Comentario>(
        `/projetos/tarefas/${tarefaId}/comentarios/`,
        { texto }
      );
      await carregar();
      return resp.data;
    },
    [tarefaId, carregar]
  );

  const editar = useCallback(
    async (comentarioId: string, texto: string) => {
      const resp = await api.patch<Comentario>(
        `/projetos/tarefas/${tarefaId}/comentarios/${comentarioId}/`,
        { texto }
      );
      await carregar();
      return resp.data;
    },
    [tarefaId, carregar]
  );

  const deletar = useCallback(
    async (comentarioId: string) => {
      await api.delete(
        `/projetos/tarefas/${tarefaId}/comentarios/${comentarioId}/`
      );
      await carregar();
    },
    [tarefaId, carregar]
  );

  return { comentarios, loading, error, recarregar: carregar, adicionar, editar, deletar };
}

// ── Checklist ─────────────────────────────────────────────

export function useChecklist(tarefaId: string | null) {
  const adicionar = useCallback(
    async (texto: string, ordem = 0): Promise<ChecklistItem> => {
      const resp = await api.post<ChecklistItem>(
        `/projetos/tarefas/${tarefaId}/checklist/`,
        { texto, ordem }
      );
      return resp.data;
    },
    [tarefaId]
  );

  const toggle = useCallback(
    async (itemId: string): Promise<ChecklistItem> => {
      const resp = await api.patch<ChecklistItem>(
        `/projetos/tarefas/${tarefaId}/checklist/${itemId}/`
      );
      return resp.data;
    },
    [tarefaId]
  );

  const deletar = useCallback(
    async (itemId: string) => {
      await api.delete(`/projetos/tarefas/${tarefaId}/checklist/${itemId}/`);
    },
    [tarefaId]
  );

  return { adicionar, toggle, deletar };
}

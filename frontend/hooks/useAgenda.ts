"use client";

import { useState, useCallback } from "react";
import api from "@/lib/api";

export interface Evento {
  id: string;
  titulo: string;
  descricao: string;
  tipo: "reuniao" | "tarefa" | "lembrete" | "compromisso" | "outro";
  cor: string;
  data_inicio: string;
  data_fim: string | null;
  dia_inteiro: boolean;
  local: string;
  concluido: boolean;
  lembrete_minutos: number | null;
  criado_em: string;
}

export interface EventoFormData {
  titulo: string;
  descricao?: string;
  tipo?: Evento["tipo"];
  cor?: string;
  data_inicio: string;
  data_fim?: string | null;
  dia_inteiro?: boolean;
  local?: string;
  lembrete_minutos?: number | null;
}

export const TIPO_EVENTO_LABELS: Record<Evento["tipo"], string> = {
  reuniao: "Reunião",
  tarefa: "Tarefa",
  lembrete: "Lembrete",
  compromisso: "Compromisso",
  outro: "Outro",
};

export const TIPO_EVENTO_CORES: Record<Evento["tipo"], string> = {
  reuniao: "#2563EB",
  tarefa: "#059669",
  lembrete: "#D97706",
  compromisso: "#6D28D9",
  outro: "#6B7280",
};

export function useAgenda() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async (dataInicio?: string, dataFim?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dataInicio) params.set("data_inicio", dataInicio);
      if (dataFim) params.set("data_fim", dataFim);
      const query = params.toString();
      const res = await api.get<{ data: Evento[] }>(`/agenda/eventos/${query ? `?${query}` : ""}`);
      setEventos(res.data?.data || []);
    } catch {
      setError("Erro ao carregar eventos.");
    } finally {
      setLoading(false);
    }
  }, []);

  const criar = useCallback(async (dados: EventoFormData): Promise<Evento | null> => {
    try {
      const res = await api.post<{ data: Evento }>("/agenda/eventos/", dados);
      const novo = res.data?.data;
      if (novo) setEventos((prev) => [...prev, novo].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio)));
      return novo || null;
    } catch {
      return null;
    }
  }, []);

  const atualizar = useCallback(async (id: string, dados: Partial<EventoFormData & { concluido?: boolean }>): Promise<Evento | null> => {
    try {
      const res = await api.patch<{ data: Evento }>(`/agenda/eventos/${id}/`, dados);
      const atualizado = res.data?.data;
      if (atualizado) {
        setEventos((prev) => prev.map((e) => (e.id === id ? atualizado : e)));
      }
      return atualizado || null;
    } catch {
      return null;
    }
  }, []);

  const deletar = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/agenda/eventos/${id}/`);
      setEventos((prev) => prev.filter((e) => e.id !== id));
      return true;
    } catch {
      return false;
    }
  }, []);

  return { eventos, loading, error, carregar, criar, atualizar, deletar };
}

/**
 * Synapse — useAgenda (Agenda v1)
 * Gerencia eventos do calendário. Erros são SEMPRE propagados (nunca
 * engolidos) — os callers exibem toast. Load expõe estado de erro.
 */
"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/api";
import type { Evento, EventoPayload } from "@/types/agenda";

interface ClienteOption {
  id: string;
  nome: string;
}

export function useAgenda() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Carrega eventos que sobrepõem o intervalo [inicio, fim].
   * Segue todas as páginas para o calendário mostrar o período inteiro
   * (a paginação continua ativa no backend).
   */
  const carregar = useCallback(async (inicio: Date, fim: Date) => {
    setLoading(true);
    setError(null);
    try {
      const acumulado: Evento[] = [];
      let page = 1;
      // Segue paginação até acabar (next === null)
      while (true) {
        const resp = await api.get<Evento[]>("/agenda/", {
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
          page,
          page_size: 25,
        });
        acumulado.push(...((resp.data as unknown as Evento[]) ?? []));
        const total = resp.pagination?.total_pages ?? 1;
        if (page >= total) break;
        page += 1;
      }
      setEventos(acumulado);
      return acumulado;
    } catch (err) {
      setError("Não foi possível carregar a agenda.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const criar = useCallback(async (payload: EventoPayload): Promise<Evento> => {
    const resp = await api.post<Evento>("/agenda/", payload);
    return resp.data as Evento;
  }, []);

  const atualizar = useCallback(
    async (id: string, payload: Partial<EventoPayload>): Promise<Evento> => {
      const resp = await api.patch<Evento>(`/agenda/${id}/`, payload);
      return resp.data as Evento;
    },
    []
  );

  const deletar = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/agenda/${id}/`);
  }, []);

  return { eventos, loading, error, carregar, criar, atualizar, deletar };
}

/**
 * Os compromissos de UM cliente, para o perfil dele.
 *
 * Busca todos (seguindo a paginação, como a tela da Agenda faz) e separa aqui
 * em próximos e passados: a API ordena por data crescente, então pedir só a
 * primeira página traria os mais ANTIGOS — exatamente o oposto do que o perfil
 * precisa mostrar em destaque.
 */
export function useEventosDoCliente(clienteId: string | null) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try {
      const acumulado: Evento[] = [];
      let page = 1;
      while (true) {
        const resp = await api.get<Evento[]>("/agenda/", {
          cliente: clienteId,
          page,
          page_size: 50,
        });
        acumulado.push(...((resp.data as unknown as Evento[]) ?? []));
        const total = resp.pagination?.total_pages ?? 1;
        if (page >= total) break;
        page += 1;
      }
      setEventos(acumulado);
      return acumulado;
    } catch (err) {
      setError("Não foi possível carregar os compromissos.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  return { eventos, loading, error, carregar };
}

/**
 * Busca clientes do CRM para o select do formulário de evento.
 * Erros propagam para o caller tratar.
 */
export async function buscarClientes(busca = ""): Promise<ClienteOption[]> {
  const resp = (await api.get<ClienteOption[]>("/clientes/", {
    busca: busca || undefined,
    page_size: 25,
  })) as ApiResponse<ClienteOption[]>;
  const lista = (resp.data as unknown as ClienteOption[]) ?? [];
  return lista.map((c) => ({ id: c.id, nome: c.nome }));
}

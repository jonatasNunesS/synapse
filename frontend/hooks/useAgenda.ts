/**
 * Synapse — useAgenda (Agenda v1)
 * Gerencia eventos do calendário. Erros são SEMPRE propagados (nunca
 * engolidos) — os callers exibem toast. Load expõe estado de erro.
 */
"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ApiResponse } from "@/types/api";
import type { Evento, EventoPayload } from "@/types/agenda";
import type { OpcaoVinculo } from "@/hooks/useBuscaVinculo";

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

  /**
   * Mexe num evento da lista que já está na tela, sem ir ao servidor.
   *
   * É o que deixa o arraste parecer instantâneo: o evento muda de lugar na
   * hora e o PATCH confirma depois. Se o PATCH falhar, o caller chama de novo
   * com os valores antigos e o evento volta para onde estava — em vez de
   * ficar na posição nova mentindo que salvou.
   */
  const aplicarLocal = useCallback((id: string, mudanca: Partial<Evento>) => {
    setEventos((atuais) =>
      atuais.map((e) => (e.id === id ? { ...e, ...mudanca } : e))
    );
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

  return {
    eventos,
    loading,
    error,
    carregar,
    aplicarLocal,
    criar,
    atualizar,
    deletar,
  };
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
  return useEventosPorVinculo("cliente", clienteId);
}

/**
 * Os compromissos de UM projeto, para o detalhe dele.
 *
 * Mesma mecânica do cliente: o vínculo existia só de um lado (do evento dava
 * para chegar ao projeto, do projeto não dava para ver os eventos).
 */
export function useEventosDoProjeto(projetoId: string | null) {
  return useEventosPorVinculo("projeto", projetoId);
}

/** Os compromissos de UMA venda, para o detalhe dela. */
export function useEventosDaVenda(vendaId: string | null) {
  return useEventosPorVinculo("venda", vendaId);
}

/**
 * O motor dos três hooks acima.
 *
 * Um só porque a diferença entre eles é o NOME do query param — e três cópias
 * desta paginação seriam três lugares para o mesmo defeito aparecer.
 */
function useEventosPorVinculo(
  campo: "cliente" | "projeto" | "venda",
  valor: string | null
) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // O instante em que a lista chegou — é ele que separa "já foi" de "vem aí".
  // Marcado aqui, e não no render do componente: ler o relógio durante o
  // render deixa o resultado instável a cada re-renderização.
  const [carregadoEm, setCarregadoEm] = useState(0);

  const carregar = useCallback(async () => {
    if (!valor) return;
    setLoading(true);
    setError(null);
    try {
      const acumulado: Evento[] = [];
      let page = 1;
      while (true) {
        const resp = await api.get<Evento[]>("/agenda/", {
          [campo]: valor,
          page,
          page_size: 50,
        });
        acumulado.push(...((resp.data as unknown as Evento[]) ?? []));
        const total = resp.pagination?.total_pages ?? 1;
        if (page >= total) break;
        page += 1;
      }
      setEventos(acumulado);
      setCarregadoEm(Date.now());
      return acumulado;
    } catch (err) {
      setError("Não foi possível carregar os compromissos.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [campo, valor]);

  return { eventos, loading, error, carregadoEm, carregar };
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

/** Busca projetos para o seletor de vínculo. Rótulo = nome do projeto. */
export async function buscarProjetos(busca = ""): Promise<OpcaoVinculo[]> {
  const resp = (await api.get<{ id: string; nome: string }[]>("/projetos/", {
    busca: busca || undefined,
    page_size: 25,
  })) as ApiResponse<{ id: string; nome: string }[]>;
  const lista = (resp.data as unknown as { id: string; nome: string }[]) ?? [];
  return lista.map((p) => ({ id: p.id, rotulo: p.nome }));
}

/**
 * Busca vendas para o seletor de vínculo.
 *
 * O rótulo é montado aqui porque venda não tem nome: é a data mais quem
 * comprou, que é como a pessoa reconhece qual venda é. O valor entra
 * formatado pelo `formatCurrency` — a mesma função do resto do sistema, para
 * não aparecer um "R$ 150.00" torto só neste seletor.
 */
export async function buscarVendas(busca = ""): Promise<OpcaoVinculo[]> {
  const resp = (await api.get<VendaResumida[]>("/vendas/", {
    busca: busca || undefined,
    page_size: 25,
  })) as ApiResponse<VendaResumida[]>;
  const lista = (resp.data as unknown as VendaResumida[]) ?? [];
  return lista.map((v) => ({
    id: v.id,
    rotulo: rotuloDaVenda(v),
    // Desce junto para o formulário poder oferecer "essa venda é da Ana,
    // vincular a ela também?" sem uma segunda ida ao servidor.
    clienteSugerido:
      v.cliente && v.cliente_nome ? { id: v.cliente, nome: v.cliente_nome } : null,
  }));
}

interface VendaResumida {
  id: string;
  data_venda: string | null;
  total: string | number | null;
  cliente: string | null;
  cliente_nome: string | null;
  devedor?: string;
}

/** "05/10/2026 · Ana Paula · R$ 150,00" — exportado para o teste afirmar o formato. */
export function rotuloDaVenda(v: VendaResumida): string {
  const partes: string[] = [];
  // `formatDate` trata data pura sem escorregar o dia (ver `paraData`), então
  // não é mais preciso remontar os pedaços à mão aqui.
  if (v.data_venda) partes.push(formatDate(v.data_venda));
  const quem = v.cliente_nome || v.devedor;
  if (quem) partes.push(quem);
  partes.push(formatCurrency(v.total));
  return partes.join(" · ");
}

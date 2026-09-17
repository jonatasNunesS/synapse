/**
 * A tela da Agenda.
 *
 * Duas coisas importam aqui: no celular a agenda abre na LISTA (o mês em
 * 375px é ilegível), e o período buscado no backend precisa bater com o que
 * a visão mostra — senão a tela mente por omissão.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Views } from "react-big-calendar";
import { addDays, endOfDay, startOfDay } from "date-fns";

import AgendaPage, { intervaloVisivel } from "./page";
import { DIAS_NA_LISTA } from "@/components/agenda/AgendaCalendario";
import type { Evento } from "@/types/agenda";

// O calendário vira uma sonda: o que se testa é QUAL visão a página escolheu
// e com que período ela chamou o backend, não o desenho da grade.
let viewRecebida: string | undefined;
vi.mock("@/components/agenda/AgendaCalendario", () => ({
  DIAS_NA_LISTA: 30,
  AgendaCalendario: ({ view }: { view: string }) => {
    viewRecebida = view;
    return <div data-testid="calendario" data-view={view} />;
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

/** Eventos que o hook devolve nesta renderização. */
let eventos: Evento[] = [];
const carregar = vi.fn().mockResolvedValue([]);
vi.mock("@/hooks/useAgenda", () => ({
  useAgenda: () => ({
    eventos,
    loading: false,
    carregar,
    criar: vi.fn(),
    atualizar: vi.fn(),
    deletar: vi.fn(),
  }),
}));

/** Largura da tela nesta renderização. */
let telaEstreita = false;
vi.mock("@/hooks/useTelaEstreita", () => ({
  useTelaEstreita: () => telaEstreita,
}));

beforeEach(() => {
  eventos = [];
  telaEstreita = false;
  viewRecebida = undefined;
  carregar.mockClear();
});

describe("Qual visão abre", () => {
  it("no celular, abre na lista", async () => {
    telaEstreita = true;
    render(<AgendaPage />);

    await waitFor(() => expect(screen.getByTestId("calendario")).toBeInTheDocument());
    expect(viewRecebida).toBe(Views.AGENDA);
  });

  it("no desktop, abre no mês", async () => {
    telaEstreita = false;
    render(<AgendaPage />);

    await waitFor(() => expect(screen.getByTestId("calendario")).toBeInTheDocument());
    expect(viewRecebida).toBe(Views.MONTH);
  });
});

describe("O período buscado acompanha a visão", () => {
  const periodo = () => carregar.mock.calls.at(-1)!;

  it("na lista, busca o mesmo período que a lista cobre", async () => {
    telaEstreita = true;
    render(<AgendaPage />);

    await waitFor(() => expect(carregar).toHaveBeenCalled());
    const [inicio, fim] = periodo();
    // Do começo do dia atual até o fim do dia `DIAS_NA_LISTA` à frente — o
    // mesmo intervalo que o react-big-calendar desenha com `length`. Sem este
    // caso na `intervaloVisivel`, a lista cairia no intervalo de um dia só e
    // mostraria bem menos do que diz cobrir.
    expect(inicio).toEqual(startOfDay(inicio));
    expect(fim).toEqual(endOfDay(addDays(startOfDay(inicio), DIAS_NA_LISTA)));
  });

  it("no mês, busca a janela do mês", async () => {
    render(<AgendaPage />);

    await waitFor(() => expect(carregar).toHaveBeenCalled());
    const [inicio, fim] = periodo();
    const dias = Math.round(
      (fim.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)
    );
    // Um mês com as semanas parciais das pontas: entre 28 e 42 dias.
    expect(dias).toBeGreaterThanOrEqual(27);
    expect(dias).toBeLessThanOrEqual(42);
  });
});

describe("intervaloVisivel", () => {
  const dia = new Date("2026-10-15T13:00:00");

  it("na lista, vai do dia atual até 30 dias à frente", () => {
    const { inicio, fim } = intervaloVisivel(dia, Views.AGENDA);

    expect(inicio).toEqual(startOfDay(dia));
    expect(fim).toEqual(endOfDay(addDays(dia, DIAS_NA_LISTA)));
  });

  it("no dia, cobre só aquele dia", () => {
    const { inicio, fim } = intervaloVisivel(dia, Views.DAY);

    expect(inicio).toEqual(startOfDay(dia));
    expect(fim).toEqual(endOfDay(dia));
  });
});

describe("Tela vazia", () => {
  it("sem eventos, o mês explica o que fazer em vez de ficar em branco", async () => {
    render(<AgendaPage />);

    expect(
      await screen.findByText(/nenhum evento neste período/i)
    ).toBeInTheDocument();
  });

  it("com eventos, não aparece", async () => {
    eventos = [
      {
        id: "e1", titulo: "Reunião", descricao: "",
        data_inicio: new Date().toISOString(), data_fim: new Date().toISOString(),
        dia_inteiro: false, local: "", cor: "#6D28D9", lembrete_antecedencia: 0,
        cliente: null, cliente_nome: null, criado_por: null, criado_por_nome: null,
        criado_em: "", atualizado_em: "",
      },
    ];
    render(<AgendaPage />);

    await waitFor(() => expect(screen.getByTestId("calendario")).toBeInTheDocument());
    expect(screen.queryByText(/nenhum evento neste período/i)).not.toBeInTheDocument();
  });

  it("na lista, quem dá o recado é a própria biblioteca", async () => {
    // Duas mensagens de vazio na mesma tela seria pior que nenhuma.
    telaEstreita = true;
    render(<AgendaPage />);

    await waitFor(() => expect(screen.getByTestId("calendario")).toBeInTheDocument());
    expect(screen.queryByText(/nenhum evento neste período/i)).not.toBeInTheDocument();
  });
});

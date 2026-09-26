/**
 * A tela da Agenda.
 *
 * Duas coisas importam aqui: no celular a agenda abre na LISTA (o mês em
 * 375px é ilegível), e o período buscado no backend precisa bater com o que
 * a visão mostra — senão a tela mente por omissão.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { Views } from "react-big-calendar";
import { addDays, endOfDay, startOfDay } from "date-fns";

import AgendaPage, { intervaloVisivel } from "./page";
import { DIAS_NA_LISTA } from "@/components/agenda/AgendaCalendario";
import type { CategoriaEvento, Evento } from "@/types/agenda";

// O calendário vira uma sonda: o que se testa é QUAL visão a página escolheu,
// com que período ela chamou o backend e o que ela faz com um arraste — não o
// desenho da grade.
let viewRecebida: string | undefined;
/** Dispara um arraste como o calendário dispararia. */
let remarcarDoCalendario: ((r: unknown) => void) | undefined;
/** Dispara a seleção de um horário livre, como o calendário faria. */
let selecionarSlot: ((s: unknown) => void) | undefined;
vi.mock("@/components/agenda/AgendaCalendario", () => ({
  DIAS_NA_LISTA: 30,
  AgendaCalendario: ({
    view,
    onRemarcar,
    onSelectSlot,
  }: {
    view: string;
    onRemarcar?: (r: unknown) => void;
    onSelectSlot?: (s: unknown) => void;
  }) => {
    viewRecebida = view;
    remarcarDoCalendario = onRemarcar;
    selecionarSlot = onSelectSlot;
    return <div data-testid="calendario" data-view={view} />;
  },
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
    info: (...a: unknown[]) => toastInfo(...a),
  },
}));

/** Eventos que o hook devolve nesta renderização. */
let eventos: Evento[] = [];
const carregar = vi.fn().mockResolvedValue([]);
const aplicarLocal = vi.fn();
const atualizar = vi.fn();
vi.mock("@/hooks/useAgenda", () => ({
  useAgenda: () => ({
    eventos,
    loading: false,
    carregar,
    aplicarLocal,
    criar: vi.fn(),
    atualizar,
    deletar: vi.fn(),
  }),
}));

/** Largura da tela nesta renderização. */
let telaEstreita = false;
vi.mock("@/hooks/useTelaEstreita", () => ({
  useTelaEstreita: () => telaEstreita,
}));

/** A duração padrão da empresa nesta renderização. */
let duracaoPadrao = 60;
vi.mock("@/hooks/useExpediente", () => ({
  useExpediente: () => ({
    min: new Date(2000, 0, 1, 7, 0),
    max: new Date(2000, 0, 1, 20, 0),
  }),
  useDuracaoPadrao: () => duracaoPadrao,
}));

/** Categorias da empresa nesta renderização (alimentam a legenda). */
let categorias: CategoriaEvento[] = [];
const carregarCategorias = vi.fn().mockResolvedValue([]);
vi.mock("@/hooks/useCategoriasAgenda", () => ({
  useCategoriasAgenda: () => ({
    categorias,
    loading: false,
    error: null,
    carregar: carregarCategorias,
    criar: vi.fn(),
    atualizar: vi.fn(),
    definirAtivo: vi.fn(),
  }),
}));

vi.mock("@/components/agenda/CategoriaEventoModal", () => ({
  CategoriaEventoModal: () => <div data-testid="categorias-modal" />,
}));

/** Perfil do usuário logado nesta renderização. */
let perfil = "colaborador";
vi.mock("@/store/useAppStore", () => ({
  useAppStore: (seletor: (s: unknown) => unknown) =>
    seletor({ usuario: { perfil } }),
}));

/** O slot com que o formulário foi aberto. */
let slotDoFormulario: { inicio: Date; fim: Date } | null = null;
vi.mock("@/components/agenda/EventoForm", () => ({
  EventoForm: ({ slotInicial }: { slotInicial: { inicio: Date; fim: Date } | null }) => {
    slotDoFormulario = slotInicial;
    return <div data-testid="evento-form" />;
  },
}));

beforeEach(() => {
  eventos = [];
  categorias = [];
  perfil = "colaborador";
  carregarCategorias.mockClear();
  telaEstreita = false;
  viewRecebida = undefined;
  remarcarDoCalendario = undefined;
  selecionarSlot = undefined;
  slotDoFormulario = null;
  duracaoPadrao = 60;
  carregar.mockClear();
  aplicarLocal.mockClear();
  atualizar.mockReset();
  toastError.mockClear();
  toastSuccess.mockClear();
  toastInfo.mockClear();
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
        dia_inteiro: false, local: "", cor: "#6D28D9", cor_efetiva: "#6D28D9",
        categoria: null, categoria_nome: null, lembrete_antecedencia: 0,
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

describe("Arrastar para remarcar", () => {
  const ORIGINAL = {
    inicio: "2026-10-05T14:00:00.000Z",
    fim: "2026-10-05T15:00:00.000Z",
  };
  const NOVO = {
    inicio: new Date("2026-10-07T09:00:00.000Z"),
    fim: new Date("2026-10-07T10:00:00.000Z"),
  };

  function evento(over: Partial<Evento> = {}): Evento {
    return {
      id: "e1",
      titulo: "Reunião",
      descricao: "",
      data_inicio: ORIGINAL.inicio,
      data_fim: ORIGINAL.fim,
      dia_inteiro: false,
      local: "",
      cor: "#6D28D9",
      cor_efetiva: "#6D28D9",
      categoria: null,
      categoria_nome: null,
      lembrete_antecedencia: 0,
      cliente: null,
      cliente_nome: null,
      criado_por: null,
      criado_por_nome: null,
      criado_em: "",
      atualizado_em: "",
      ...over,
    };
  }

  /** Monta a tela e solta o evento no período novo. */
  async function arrastar(
    over: Partial<Evento> = {},
    destino = NOVO,
    viraDiaInteiro?: boolean
  ) {
    const alvo = evento(over);
    eventos = [alvo];
    render(<AgendaPage />);
    await waitFor(() => expect(remarcarDoCalendario).toBeDefined());

    await remarcarDoCalendario!({
      evento: alvo,
      inicio: destino.inicio,
      fim: destino.fim,
      viraDiaInteiro: viraDiaInteiro ?? alvo.dia_inteiro,
    });
    return alvo;
  }

  it("salva o período novo", async () => {
    atualizar.mockResolvedValue(evento({
      data_inicio: NOVO.inicio.toISOString(),
      data_fim: NOVO.fim.toISOString(),
    }));

    await arrastar();

    await waitFor(() => expect(atualizar).toHaveBeenCalledTimes(1));
    expect(atualizar).toHaveBeenCalledWith("e1", {
      data_inicio: NOVO.inicio.toISOString(),
      data_fim: NOVO.fim.toISOString(),
    });
  });

  it("move o evento na hora, antes de o servidor responder", async () => {
    atualizar.mockResolvedValue(evento());

    await arrastar();

    // A primeira aplicação local é o movimento otimista.
    expect(aplicarLocal.mock.calls[0]).toEqual([
      "e1",
      { data_inicio: NOVO.inicio.toISOString(), data_fim: NOVO.fim.toISOString() },
    ]);
  });

  it("a resposta do servidor manda, não o que o calendário calculou", async () => {
    // O backend normaliza o dia inteiro; o que ele devolve é a verdade.
    const normalizado = evento({
      data_inicio: "2026-10-07T03:00:00.000Z",
      data_fim: "2026-10-08T02:59:59.000Z",
    });
    atualizar.mockResolvedValue(normalizado);

    await arrastar();

    await waitFor(() => expect(aplicarLocal).toHaveBeenCalledTimes(2));
    expect(aplicarLocal.mock.calls[1]).toEqual(["e1", normalizado]);
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("se o PATCH falha, o evento volta para onde estava", async () => {
    atualizar.mockRejectedValue(new Error("deu ruim"));

    await arrastar();

    await waitFor(() => expect(aplicarLocal).toHaveBeenCalledTimes(2));
    // Deixar na posição nova seria a tela mentindo que salvou.
    expect(aplicarLocal.mock.calls[1]).toEqual([
      "e1",
      { data_inicio: ORIGINAL.inicio, data_fim: ORIGINAL.fim },
    ]);
    expect(toastError).toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("soltar no mesmo lugar não chama o servidor", async () => {
    await arrastar({}, {
      inicio: new Date(ORIGINAL.inicio),
      fim: new Date(ORIGINAL.fim),
    });

    expect(atualizar).not.toHaveBeenCalled();
    expect(aplicarLocal).not.toHaveBeenCalled();
  });
});

describe("Arrastar não troca a natureza do evento", () => {
  function evento(over: Partial<Evento> = {}): Evento {
    return {
      id: "e1", titulo: "Reunião", descricao: "",
      data_inicio: "2026-10-05T14:00:00.000Z",
      data_fim: "2026-10-05T15:00:00.000Z",
      dia_inteiro: false, local: "", cor: "#6D28D9", cor_efetiva: "#6D28D9",
      categoria: null, categoria_nome: null, lembrete_antecedencia: 0,
      cliente: null, cliente_nome: null, criado_por: null, criado_por_nome: null,
      criado_em: "", atualizado_em: "", ...over,
    };
  }

  async function soltar(alvo: Evento, viraDiaInteiro: boolean) {
    eventos = [alvo];
    render(<AgendaPage />);
    await waitFor(() => expect(remarcarDoCalendario).toBeDefined());
    await remarcarDoCalendario!({
      evento: alvo,
      inicio: new Date("2026-10-07T09:00:00.000Z"),
      fim: new Date("2026-10-07T10:00:00.000Z"),
      viraDiaInteiro,
    });
  }

  it("soltar um evento com hora na faixa de dia inteiro não salva nada", async () => {
    // Virar dia inteiro apaga o horário escolhido (o backend normaliza para
    // 00:00–23:59) e desmarcar não o traz de volta. Perder isso por um
    // arraste impreciso seria caro demais.
    await soltar(evento({ dia_inteiro: false }), true);

    expect(atualizar).not.toHaveBeenCalled();
    expect(aplicarLocal).not.toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledWith(
      expect.stringMatching(/edite o evento/i)
    );
  });

  it("tirar um evento de dia inteiro da faixa também não salva", async () => {
    await soltar(evento({ dia_inteiro: true }), false);

    expect(atualizar).not.toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalled();
  });

  it("mover um evento de dia inteiro para outro dia funciona normalmente", async () => {
    const alvo = evento({ dia_inteiro: true });
    atualizar.mockResolvedValue(alvo);

    await soltar(alvo, true); // continua dia inteiro

    await waitFor(() => expect(atualizar).toHaveBeenCalledTimes(1));
    expect(toastInfo).not.toHaveBeenCalled();
  });
});

describe("Duração padrão ao criar clicando num horário livre", () => {
  /** Clica num horário livre; `fim` ausente é o que o mês entrega. */
  async function clicarEm(inicio: Date, fim?: Date) {
    render(<AgendaPage />);
    await waitFor(() => expect(selecionarSlot).toBeDefined());
    await act(async () => {
      selecionarSlot!({ start: inicio, end: fim });
    });
    await waitFor(() =>
      expect(screen.getByTestId("evento-form")).toBeInTheDocument()
    );
  }

  /** Quantos minutos o formulário abriu. */
  const minutosDoFormulario = () =>
    (slotDoFormulario!.fim.getTime() - slotDoFormulario!.inicio.getTime()) / 60000;

  it("usa a duração que a empresa configurou", async () => {
    duracaoPadrao = 30;

    await clicarEm(new Date("2026-10-05T14:00:00"));

    expect(minutosDoFormulario()).toBe(30);
  });

  it("outra empresa, outra duração", async () => {
    duracaoPadrao = 120;

    await clicarEm(new Date("2026-10-05T14:00:00"));

    expect(minutosDoFormulario()).toBe(120);
  });

  it("sem configuração, uma hora", async () => {
    await clicarEm(new Date("2026-10-05T14:00:00"));

    expect(minutosDoFormulario()).toBe(60);
  });

  it("o que a pessoa desenhou arrastando manda sobre a duração padrão", async () => {
    // Na semana e no dia, o slot vem com o período que ela marcou. Aí a
    // escolha é explícita e a configuração não tem o que dizer.
    duracaoPadrao = 30;

    await clicarEm(
      new Date("2026-10-05T14:00:00"),
      new Date("2026-10-05T17:00:00")
    );

    expect(minutosDoFormulario()).toBe(180);
  });

  it("um slot de fim igual ao início cai na duração padrão", async () => {
    // O mês às vezes entrega start === end; sem a guarda o evento nasceria
    // com duração zero.
    duracaoPadrao = 45;
    const inicio = new Date("2026-10-05T14:00:00");

    await clicarEm(inicio, inicio);

    expect(minutosDoFormulario()).toBe(45);
  });
});

describe("A legenda na tela da agenda", () => {
  function categoria(over: Partial<CategoriaEvento> = {}): CategoriaEvento {
    return {
      id: "c1", nome: "Cobrança", cor: "#f97316", ativo: true, ordem: 0,
      eventos_count: 0, criado_em: "", ...over,
    };
  }

  it("mostra o nome da categoria ao lado da cor dela", async () => {
    categorias = [categoria()];
    render(<AgendaPage />);

    await waitFor(() => expect(screen.getByTestId("calendario")).toBeInTheDocument());
    expect(screen.getByTestId("legenda-categorias")).toBeInTheDocument();
    expect(screen.getByText("Cobrança")).toBeInTheDocument();
    expect(screen.getByTestId("legenda-cor-c1")).toHaveStyle({
      backgroundColor: "#f97316",
    });
  });

  it("empresa sem categoria nenhuma: nada de legenda vazia ocupando a tela", async () => {
    render(<AgendaPage />);

    await waitFor(() => expect(screen.getByTestId("calendario")).toBeInTheDocument());
    expect(screen.queryByTestId("legenda-categorias")).not.toBeInTheDocument();
  });

  it("falhar ao carregar as categorias não derruba o calendário", async () => {
    // Sem legenda a agenda é o que já era. Sem calendário, ela não serve.
    carregarCategorias.mockRejectedValueOnce(new Error("rede caiu"));
    render(<AgendaPage />);

    await waitFor(() => expect(screen.getByTestId("calendario")).toBeInTheDocument());
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe("Quem gerencia as categorias", () => {
  it("o admin tem o botão de categorias", async () => {
    perfil = "admin";
    render(<AgendaPage />);

    await waitFor(() => expect(screen.getByTestId("calendario")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /categorias/i })).toBeInTheDocument();
  });

  it("o colaborador USA as categorias, mas não as cria", async () => {
    perfil = "colaborador";
    render(<AgendaPage />);

    await waitFor(() => expect(screen.getByTestId("calendario")).toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: /categorias/i })
    ).not.toBeInTheDocument();
  });

  it("o botão abre a gestão", async () => {
    perfil = "admin";
    render(<AgendaPage />);

    await waitFor(() => expect(screen.getByTestId("calendario")).toBeInTheDocument());
    expect(screen.queryByTestId("categorias-modal")).not.toBeInTheDocument();

    await act(async () => {
      screen.getByRole("button", { name: /categorias/i }).click();
    });

    expect(screen.getByTestId("categorias-modal")).toBeInTheDocument();
  });
});

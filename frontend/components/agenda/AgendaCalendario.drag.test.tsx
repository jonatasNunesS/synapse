/**
 * A ligação entre o calendário e o arraste.
 *
 * O teste da página mocka o `AgendaCalendario`, então nada lá prova que o
 * `onRemarcar` chega de fato ao addon do react-big-calendar. Aqui o addon
 * vira uma sonda: o que se testa é QUAIS props o calendário recebe e o que
 * ele faz com o que o addon devolve.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

import type { Evento } from "@/types/agenda";

/** As props que o calendário arrastável recebeu na última renderização. */
let props: Record<string, unknown> = {};
vi.mock("react-big-calendar/lib/addons/dragAndDrop", () => ({
  default: () => (p: Record<string, unknown>) => {
    props = p;
    return <div data-testid="calendario-arrastavel" />;
  },
}));

// CSS não importa aqui e o jsdom não processa os arquivos do addon.
vi.mock("react-big-calendar/lib/addons/dragAndDrop/styles.css", () => ({}));

import { AgendaCalendario, type Remarcacao } from "./AgendaCalendario";

function evento(over: Partial<Evento> = {}): Evento {
  return {
    id: "e1",
    titulo: "Reunião",
    descricao: "",
    data_inicio: "2026-10-05T14:00:00.000Z",
    data_fim: "2026-10-05T15:00:00.000Z",
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

function montar(onRemarcar?: (r: Remarcacao) => void, alvo = evento()) {
  render(
    <AgendaCalendario
      eventos={[alvo]}
      view="month"
      date={new Date("2026-10-05T12:00:00")}
      onView={vi.fn()}
      onNavigate={vi.fn()}
      onSelectSlot={vi.fn()}
      onSelectEvent={vi.fn()}
      onRemarcar={onRemarcar}
    />
  );
  return alvo;
}

beforeEach(() => {
  props = {};
});

describe("Com onRemarcar, o arraste está ligado", () => {
  it("passa os dois gestos ao calendário: mover e esticar", () => {
    montar(vi.fn());

    expect(props.onEventDrop).toBeTypeOf("function");
    expect(props.onEventResize).toBeTypeOf("function");
    expect(props.resizable).toBe(true);
  });

  it("os eventos ficam arrastáveis", () => {
    montar(vi.fn());

    const podeArrastar = props.draggableAccessor as (e: unknown) => boolean;
    expect(podeArrastar(null)).toBe(true);
  });
});

describe("Sem onRemarcar, o calendário é só de leitura", () => {
  it("não passa gesto nenhum", () => {
    montar(undefined);

    expect(props.onEventDrop).toBeUndefined();
    expect(props.onEventResize).toBeUndefined();
    expect(props.resizable).toBe(false);
  });

  it("os eventos não ficam arrastáveis", () => {
    montar(undefined);

    const podeArrastar = props.draggableAccessor as (e: unknown) => boolean;
    expect(podeArrastar(null)).toBe(false);
  });
});

describe("O que o addon devolve vira uma Remarcação", () => {
  /** Dispara o gesto como o addon dispararia, e devolve o que a página viu. */
  function soltar(
    gesto: "onEventDrop" | "onEventResize",
    args: Record<string, unknown>,
    alvo = evento()
  ) {
    const onRemarcar = vi.fn();
    montar(onRemarcar, alvo);
    (props[gesto] as (a: unknown) => void)({
      event: { resource: alvo },
      ...args,
    });
    return onRemarcar.mock.calls[0]?.[0] as Remarcacao | undefined;
  }

  it("mover entrega o evento e o período novo", () => {
    const r = soltar("onEventDrop", {
      start: new Date("2026-10-07T09:00:00.000Z"),
      end: new Date("2026-10-07T10:00:00.000Z"),
    });

    expect(r!.evento.id).toBe("e1");
    expect(r!.inicio.toISOString()).toBe("2026-10-07T09:00:00.000Z");
    expect(r!.fim.toISOString()).toBe("2026-10-07T10:00:00.000Z");
  });

  it("esticar entrega a duração nova pelo mesmo caminho", () => {
    const r = soltar("onEventResize", {
      start: new Date("2026-10-05T14:00:00.000Z"),
      end: new Date("2026-10-05T17:00:00.000Z"),
    });

    expect(r!.fim.toISOString()).toBe("2026-10-05T17:00:00.000Z");
  });

  it("converte data em texto, que é o que o addon pode mandar", () => {
    // O tipo do addon é `stringOrDate`: a página só trabalha com Date.
    const r = soltar("onEventDrop", {
      start: "2026-10-07T09:00:00.000Z",
      end: "2026-10-07T10:00:00.000Z",
    });

    expect(r!.inicio).toBeInstanceOf(Date);
    expect(r!.inicio.toISOString()).toBe("2026-10-07T09:00:00.000Z");
  });

  it("avisa quando soltou na faixa de dia inteiro", () => {
    const r = soltar("onEventDrop", {
      start: new Date("2026-10-07T00:00:00.000Z"),
      end: new Date("2026-10-07T23:59:00.000Z"),
      isAllDay: true,
    });

    expect(r!.viraDiaInteiro).toBe(true);
  });

  it("sem a marca do addon, não é dia inteiro", () => {
    // `isAllDay` é opcional no addon; ausente não pode virar `undefined` e
    // escapar da comparação que a página faz com `dia_inteiro`.
    const r = soltar("onEventDrop", {
      start: new Date("2026-10-07T09:00:00.000Z"),
      end: new Date("2026-10-07T10:00:00.000Z"),
    });

    expect(r!.viraDiaInteiro).toBe(false);
  });
});

describe("Expediente: recorta a grade, não esconde evento", () => {
  it("passa min e max ao calendário", () => {
    const expediente = {
      min: new Date(2000, 0, 1, 9, 0),
      max: new Date(2000, 0, 1, 18, 0),
    };
    render(
      <AgendaCalendario
        eventos={[evento()]}
        view="week"
        date={new Date("2026-10-05T12:00:00")}
        onView={vi.fn()}
        onNavigate={vi.fn()}
        onSelectSlot={vi.fn()}
        onSelectEvent={vi.fn()}
        expediente={expediente}
      />
    );

    expect(props.min).toBe(expediente.min);
    expect(props.max).toBe(expediente.max);
  });

  it("um evento fora do expediente continua sendo entregue ao calendário", () => {
    // O recorte é de DESENHO. Se o componente filtrasse pelo expediente, o
    // compromisso das 5h sumiria da tela — o oposto do que o audit pedia.
    const madrugada = evento({
      id: "cedo",
      titulo: "Entrega na madrugada",
      data_inicio: "2026-10-05T08:00:00.000Z", // 05:00 em São Paulo
      data_fim: "2026-10-05T09:00:00.000Z",
    });
    render(
      <AgendaCalendario
        eventos={[madrugada]}
        view="week"
        date={new Date("2026-10-05T12:00:00")}
        onView={vi.fn()}
        onNavigate={vi.fn()}
        onSelectSlot={vi.fn()}
        onSelectEvent={vi.fn()}
        expediente={{
          min: new Date(2000, 0, 1, 9, 0),
          max: new Date(2000, 0, 1, 18, 0),
        }}
      />
    );

    const items = props.events as { id: string }[];
    expect(items.map((e) => e.id)).toContain("cedo");
  });

  it("sem expediente, o calendário não recebe recorte nenhum", () => {
    montar(vi.fn());

    expect(props.min).toBeUndefined();
    expect(props.max).toBeUndefined();
  });
});

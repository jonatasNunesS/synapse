/**
 * O calendário — com foco na visão de lista.
 *
 * A lista é a visão que salva o celular, e ela já vinha traduzida no código
 * sem estar ligada. Estes testes existem para que ninguém a desligue de novo
 * sem perceber.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Views, type View } from "react-big-calendar";

import { AgendaCalendario, DIAS_NA_LISTA } from "./AgendaCalendario";
import type { Evento } from "@/types/agenda";

function evento(over: Partial<Evento> = {}): Evento {
  const inicio = new Date("2026-10-05T14:00:00");
  return {
    id: "e1",
    titulo: "Reunião com o fornecedor",
    descricao: "",
    data_inicio: inicio.toISOString(),
    data_fim: new Date(inicio.getTime() + 3600_000).toISOString(),
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

function renderCalendario(view: View = Views.MONTH) {
  render(
    <AgendaCalendario
      eventos={[evento()]}
      view={view}
      date={new Date("2026-10-05T12:00:00")}
      onView={vi.fn()}
      onNavigate={vi.fn()}
      onSelectSlot={vi.fn()}
      onSelectEvent={vi.fn()}
    />
  );
}

describe("As visões oferecidas", () => {
  it("oferece a lista junto de mês, semana e dia", () => {
    renderCalendario();

    for (const rotulo of ["Mês", "Semana", "Dia", "Agenda"]) {
      expect(screen.getByRole("button", { name: rotulo })).toBeInTheDocument();
    }
  });

  it("a lista mostra os eventos do período", () => {
    renderCalendario(Views.AGENDA);

    expect(screen.getAllByText(/reunião com o fornecedor/i).length).toBeGreaterThan(0);
  });
});

describe("O alcance da lista", () => {
  it("mostra o que está dentro de DIAS_NA_LISTA e não o que passa disso", () => {
    // A página busca no backend exatamente este período (`intervaloVisivel`).
    // Se o calendário e a constante se separarem, a lista passa a mostrar
    // menos — ou mais — do que a página foi buscar.
    const hoje = new Date("2026-10-05T12:00:00");
    const emDias = (d: number) =>
      new Date(hoje.getTime() + d * 24 * 60 * 60 * 1000);

    const dentro = emDias(DIAS_NA_LISTA - 2);
    const fora = emDias(DIAS_NA_LISTA + 5);

    render(
      <AgendaCalendario
        eventos={[
          evento({
            id: "dentro", titulo: "Dentro do alcance",
            data_inicio: dentro.toISOString(),
            data_fim: new Date(dentro.getTime() + 3600_000).toISOString(),
          }),
          evento({
            id: "fora", titulo: "Depois do alcance",
            data_inicio: fora.toISOString(),
            data_fim: new Date(fora.getTime() + 3600_000).toISOString(),
          }),
        ]}
        view={Views.AGENDA}
        date={hoje}
        onView={vi.fn()}
        onNavigate={vi.fn()}
        onSelectSlot={vi.fn()}
        onSelectEvent={vi.fn()}
      />
    );

    expect(screen.getByText("Dentro do alcance")).toBeInTheDocument();
    expect(screen.queryByText("Depois do alcance")).not.toBeInTheDocument();
  });
});

describe("A cor que o calendário pinta", () => {
  /** O bloco do evento na grade — é nele que a cor aparece. */
  function blocoDe(titulo: string): HTMLElement {
    const rotulo = screen.getAllByText(titulo)[0];
    const bloco = rotulo.closest(".rbc-event") as HTMLElement | null;
    expect(bloco).not.toBeNull();
    return bloco!;
  }

  function pintar(over: Partial<Evento>) {
    render(
      <AgendaCalendario
        eventos={[evento(over)]}
        view={Views.MONTH}
        date={new Date("2026-10-05T12:00:00")}
        onView={vi.fn()}
        onNavigate={vi.fn()}
        onSelectSlot={vi.fn()}
        onSelectEvent={vi.fn()}
      />
    );
  }

  it("evento com categoria sai na cor DA CATEGORIA, não na cor antiga dele", () => {
    // O caso que motivou as categorias: o evento guarda um roxo de antes, mas
    // agora ele é "Cobrança" e Cobrança é laranja. A tela tem que mostrar
    // laranja — senão a legenda diz uma coisa e o calendário mostra outra.
    pintar({
      titulo: "Cobrar o fornecedor",
      cor: "#6D28D9",
      cor_efetiva: "#f97316",
      categoria: "c1",
      categoria_nome: "Cobrança",
    });

    expect(blocoDe("Cobrar o fornecedor")).toHaveStyle({
      backgroundColor: "#f97316",
    });
  });

  it("evento sem categoria continua na cor que sempre teve", () => {
    pintar({ titulo: "Follow-up antigo", cor: "#3B82F6", cor_efetiva: "#3B82F6" });

    expect(blocoDe("Follow-up antigo")).toHaveStyle({ backgroundColor: "#3B82F6" });
  });
});

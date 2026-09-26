/**
 * Os compromissos do cliente, no perfil dele.
 *
 * O que importa: o que vem à frente aparece primeiro, o que já passou fica
 * discreto embaixo, e um follow-up que virou evento na Agenda é reconhecido
 * como a MESMA coisa que o cartão de follow-up acima já anunciou — não como
 * um segundo compromisso.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import {
  CompromissosCliente,
  tituloNoPerfil,
  veioDeFollowup,
} from "./CompromissosCliente";
import type { Evento } from "@/types/agenda";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function evento(over: Partial<Evento> = {}): Evento {
  const inicio = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return {
    id: "e1",
    titulo: "Reunião",
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
    cliente: "c1",
    cliente_nome: "Maria",
    criado_por: null,
    criado_por_nome: null,
    criado_em: "",
    atualizado_em: "",
    ...over,
  };
}

/** Um evento que já aconteceu (`dias` dias atrás). */
function passado(dias: number, over: Partial<Evento> = {}): Evento {
  const inicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  return evento({
    data_inicio: inicio.toISOString(),
    data_fim: new Date(inicio.getTime() + 3600_000).toISOString(),
    ...over,
  });
}

const bloco = () => screen.getByTestId("compromissos-cliente");

describe("O que o cliente tem marcado", () => {
  it("mostra os compromissos à frente", () => {
    render(
      <CompromissosCliente
        eventos={[evento({ id: "1", titulo: "Visita técnica" })]}
        loading={false}
        agora={Date.now()}
      />
    );

    expect(within(bloco()).getByText("Visita técnica")).toBeInTheDocument();
  });

  it("separa o que já aconteceu", () => {
    render(
      <CompromissosCliente
        eventos={[
          passado(10, { id: "p1", titulo: "Reunião antiga" }),
          evento({ id: "f1", titulo: "Reunião futura" }),
        ]}
        loading={false}
        agora={Date.now()}
      />
    );

    expect(within(bloco()).getByText("Reunião futura")).toBeInTheDocument();
    expect(within(bloco()).getByText(/já aconteceram/i)).toBeInTheDocument();
    expect(within(bloco()).getByText("Reunião antiga")).toBeInTheDocument();
  });

  it("dos passados, mostra os mais recentes primeiro e só alguns", () => {
    const antigos = [5, 4, 3, 2, 1].map((d) =>
      passado(d + 10, { id: `p${d}`, titulo: `Há ${d + 10} dias` })
    );

    render(<CompromissosCliente eventos={antigos} loading={false} agora={Date.now()} />);

    const textos = within(bloco())
      .getAllByText(/há \d+ dias/i)
      .map((e) => e.textContent);
    // A API devolve em ordem crescente; o perfil quer o mais recente no topo.
    expect(textos).toEqual(["Há 11 dias", "Há 12 dias", "Há 13 dias"]);
  });

  it("só passados: diz que não há nada à frente", () => {
    render(
      <CompromissosCliente
        eventos={[passado(3, { id: "p1", titulo: "Já foi" })]}
        loading={false}
        agora={Date.now()}
      />
    );

    expect(within(bloco()).getByText(/nenhum compromisso à frente/i)).toBeInTheDocument();
  });

  it("sem nenhum, explica em vez de deixar o bloco vazio", () => {
    render(<CompromissosCliente eventos={[]} loading={false} agora={Date.now()} />);

    expect(
      within(bloco()).getByText(/nenhum compromisso com este cliente/i)
    ).toBeInTheDocument();
  });

  it("carregando, não acusa vazio", () => {
    render(<CompromissosCliente eventos={[]} loading agora={Date.now()} />);

    expect(
      within(bloco()).queryByText(/nenhum compromisso com este cliente/i)
    ).not.toBeInTheDocument();
  });
});

describe("Follow-up que virou evento não vira dois compromissos", () => {
  it("é reconhecido pelo mesmo marcador que o backend usa", () => {
    expect(veioDeFollowup(evento({ titulo: "Follow-up: Maria" }))).toBe(true);
    expect(veioDeFollowup(evento({ titulo: "Reunião" }))).toBe(false);
  });

  it("recebe o selo de follow-up", () => {
    render(
      <CompromissosCliente
        eventos={[evento({ titulo: "Follow-up: Maria" })]}
        loading={false}
        agora={Date.now()}
      />
    );

    expect(within(bloco()).getByText("follow-up")).toBeInTheDocument();
  });

  it("não repete o nome do cliente dentro do perfil dele", () => {
    // "Follow-up: Maria" no perfil da Maria diz o nome dela de volta.
    expect(tituloNoPerfil(evento({ titulo: "Follow-up: Maria" }))).toBe("Maria");
    expect(tituloNoPerfil(evento({ titulo: "Reunião" }))).toBe("Reunião");
  });

  it("um evento comum não ganha o selo", () => {
    render(
      <CompromissosCliente
        eventos={[evento({ titulo: "Reunião" })]}
        loading={false}
        agora={Date.now()}
      />
    );

    expect(within(bloco()).queryByText("follow-up")).not.toBeInTheDocument();
  });
});

describe("Como a data se apresenta", () => {
  it("dia inteiro não finge ter hora", () => {
    render(
      <CompromissosCliente
        eventos={[evento({ dia_inteiro: true })]}
        loading={false}
        agora={Date.now()}
      />
    );

    expect(within(bloco()).getByText(/dia inteiro/i)).toBeInTheDocument();
  });
});

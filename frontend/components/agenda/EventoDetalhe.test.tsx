/**
 * O detalhe do evento.
 *
 * A decisão de produto é que a agenda é COMPARTILHADA: todos da empresa
 * editam e apagam tudo. O que faltava era ver de quem é o compromisso antes
 * de mexer nele — o backend já mandava `criado_por_nome` e a tela descartava.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { EventoDetalhe } from "./EventoDetalhe";
import type { Evento } from "@/types/agenda";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

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

function abrir(over: Partial<Evento> = {}) {
  render(
    <EventoDetalhe
      evento={evento(over)}
      onEditar={vi.fn()}
      onExcluir={vi.fn()}
      onFechar={vi.fn()}
    />
  );
}

describe("Quem criou o evento", () => {
  it("aparece no detalhe", () => {
    abrir({ criado_por_nome: "Fernanda" });

    expect(screen.getByText(/criado por fernanda/i)).toBeInTheDocument();
  });

  it("aparece mesmo sem descrição", () => {
    // A autoria dividia o bloco com a descrição; sem ela, sumia junto.
    abrir({ criado_por_nome: "Fernanda", descricao: "" });

    expect(screen.getByText(/criado por fernanda/i)).toBeInTheDocument();
  });

  it("não inventa autor quando o backend não manda nenhum", () => {
    abrir({ criado_por_nome: null });

    expect(screen.queryByText(/criado por/i)).not.toBeInTheDocument();
  });

  it("não escreve 'Criado por' vazio num evento com descrição e sem autor", () => {
    // `criado_por` é SET_NULL: quem criou pode ter saído da empresa. Com
    // descrição, o bloco existe — e só a guarda interna segura a linha.
    abrir({ criado_por_nome: null, descricao: "Levar o orçamento." });

    expect(screen.getByText("Levar o orçamento.")).toBeInTheDocument();
    expect(screen.queryByText(/criado por/i)).not.toBeInTheDocument();
  });

  it("convive com a descrição", () => {
    abrir({ criado_por_nome: "Fernanda", descricao: "Levar o orçamento." });

    expect(screen.getByText("Levar o orçamento.")).toBeInTheDocument();
    expect(screen.getByText(/criado por fernanda/i)).toBeInTheDocument();
  });
});

describe("Saber de quem é NÃO restringe quem mexe", () => {
  it("editar e excluir seguem disponíveis no evento de outra pessoa", () => {
    // A decisão foi agenda compartilhada: todos podem, só ficam sabendo de
    // quem é. Se algum dia alguém esconder os botões aqui, este teste avisa.
    abrir({ criado_por_nome: "Outra Pessoa" });

    expect(screen.getByRole("button", { name: /editar/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /excluir/i })).toBeEnabled();
  });
});

describe("O lembrete", () => {
  it("aparece quando o evento tem um", () => {
    abrir({ lembrete_antecedencia: 60 });

    expect(screen.getByText("1 hora antes")).toBeInTheDocument();
  });

  it("não aparece quando o evento não tem", () => {
    abrir({ lembrete_antecedencia: 0 });

    expect(screen.queryByText(/antes/i)).not.toBeInTheDocument();
  });
});

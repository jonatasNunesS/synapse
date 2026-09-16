/**
 * O bloco de próximos compromissos no dashboard.
 *
 * É a agenda deixando de ser um beco sem saída. O que importa: mostra o que
 * vem, diz "Hoje"/"Amanhã" em vez de uma data crua, e não deixa um cartão
 * vazio sem explicação quando não há nada marcado.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  ProximosCompromissosWidget,
  rotuloDia,
  rotuloHora,
} from "./ProximosCompromissosWidget";
import type { CompromissoItem } from "@/types/dashboard";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function compromisso(over: Partial<CompromissoItem> = {}): CompromissoItem {
  const inicio = new Date();
  inicio.setHours(14, 30, 0, 0);
  return {
    id: "c1",
    titulo: "Reunião com o fornecedor",
    data_inicio: inicio.toISOString(),
    data_fim: new Date(inicio.getTime() + 3600_000).toISOString(),
    dia_inteiro: false,
    local: "",
    cor: "#6D28D9",
    cliente_id: null,
    cliente_nome: null,
    dias_restantes: 0,
    ...over,
  };
}

describe("Com compromissos", () => {
  it("lista os que vêm", () => {
    render(
      <ProximosCompromissosWidget
        compromissos={[
          compromisso({ id: "1", titulo: "Reunião" }),
          compromisso({ id: "2", titulo: "Entrega", dias_restantes: 1 }),
        ]}
        isLoading={false}
      />
    );

    expect(screen.getByText("Reunião")).toBeInTheDocument();
    expect(screen.getByText("Entrega")).toBeInTheDocument();
  });

  it("mostra o cliente e o local quando existem", () => {
    render(
      <ProximosCompromissosWidget
        compromissos={[
          compromisso({ cliente_nome: "Padaria do Zé", local: "Escritório" }),
        ]}
        isLoading={false}
      />
    );

    expect(screen.getByText("Padaria do Zé")).toBeInTheDocument();
    expect(screen.getByText(/escritório/i)).toBeInTheDocument();
  });

  it("leva para a agenda", () => {
    render(
      <ProximosCompromissosWidget
        compromissos={[compromisso()]}
        isLoading={false}
      />
    );

    const links = screen.getAllByRole("link");
    expect(links.every((l) => l.getAttribute("href") === "/agenda")).toBe(true);
  });

  it("não vira lista longa dentro do dashboard", () => {
    const muitos = Array.from({ length: 9 }, (_, i) =>
      compromisso({ id: `c${i}`, titulo: `Compromisso ${i}` })
    );

    render(<ProximosCompromissosWidget compromissos={muitos} isLoading={false} />);

    // 5 itens + o link "Ver agenda" do cabeçalho.
    expect(screen.getAllByRole("link")).toHaveLength(6);
    expect(screen.queryByText("Compromisso 5")).not.toBeInTheDocument();
  });
});

describe("Sem compromissos", () => {
  it("diz que não há nada em vez de deixar o cartão vazio", () => {
    render(<ProximosCompromissosWidget compromissos={[]} isLoading={false} />);

    expect(screen.getByText(/nenhum compromisso próximo/i)).toBeInTheDocument();
  });

  it("carregando, mostra o esqueleto e não a mensagem de vazio", () => {
    render(<ProximosCompromissosWidget compromissos={[]} isLoading />);

    expect(screen.queryByText(/nenhum compromisso próximo/i)).not.toBeInTheDocument();
  });
});

describe("Como a data se apresenta", () => {
  it("diz Hoje e Amanhã em vez de uma data crua", () => {
    expect(rotuloDia(compromisso({ dias_restantes: 0 }))).toBe("Hoje");
    expect(rotuloDia(compromisso({ dias_restantes: 1 }))).toBe("Amanhã");
  });

  it("um compromisso em andamento ainda é 'Hoje'", () => {
    // `dias_restantes` fica negativo num evento que começou antes e ainda
    // está rolando; "-1" na tela não quereria dizer nada.
    expect(rotuloDia(compromisso({ dias_restantes: -1 }))).toBe("Hoje");
  });

  it("mais longe, mostra dia/mês", () => {
    const data = new Date();
    data.setMonth(9, 12); // 12 de outubro
    expect(
      rotuloDia(compromisso({ dias_restantes: 4, data_inicio: data.toISOString() }))
    ).toBe("12/10");
  });

  it("mostra a hora, com zero à esquerda", () => {
    const data = new Date();
    data.setHours(9, 5, 0, 0);
    expect(rotuloHora(compromisso({ data_inicio: data.toISOString() }))).toBe("09:05");
  });

  it("dia inteiro não finge ter hora", () => {
    expect(rotuloHora(compromisso({ dia_inteiro: true }))).toBe("Dia inteiro");
  });
});

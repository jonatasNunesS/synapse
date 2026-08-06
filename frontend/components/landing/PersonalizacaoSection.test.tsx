/**
 * Landing — a seção de personalização: responder as perguntas muda a barra
 * lateral simulada na hora, e os presets respondem tudo de uma vez.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PersonalizacaoSection } from "./PersonalizacaoSection";

/** Itens visíveis no menu simulado (a <ul> com aria-live). */
function menu(): string[] {
  const lista = document.querySelector("ul[aria-live='polite']") as HTMLElement;
  return Array.from(lista.querySelectorAll("li")).map(
    (li) => li.textContent?.trim() ?? ""
  );
}

describe("Landing — personalização", () => {
  it("começa no preset de loja: estoque, fornecedores e documentos ligados", () => {
    render(<PersonalizacaoSection />);

    expect(menu()).toEqual([
      "Dashboard",
      "Financeiro",
      "Estoque",
      "Clientes",
      "Fornecedores",
      "Documentos",
      "Notificações",
      "Analytics",
      "AI Hub",
    ]);
    expect(screen.getByText("9 de 12 itens na barra lateral")).toBeInTheDocument();
  });

  it("desligar uma pergunta some com o item do menu", () => {
    render(<PersonalizacaoSection />);

    fireEvent.click(
      screen.getByRole("button", { name: /Controla estoque de produtos físicos/ })
    );

    expect(menu()).not.toContain("Estoque");
    expect(menu()).toContain("Fornecedores");
    expect(screen.getByText("8 de 12 itens na barra lateral")).toBeInTheDocument();
  });

  it("ligar uma pergunta acrescenta o item na posição certa", () => {
    render(<PersonalizacaoSection />);

    fireEvent.click(
      screen.getByRole("button", { name: /Precisa de agenda para compromissos/ })
    );

    const itens = menu();
    expect(itens).toContain("Agenda");
    // Agenda entra depois de Projetos/Fornecedores e antes de Documentos
    expect(itens.indexOf("Agenda")).toBeLessThan(itens.indexOf("Documentos"));
    expect(itens.indexOf("Agenda")).toBeGreaterThan(itens.indexOf("Fornecedores"));
    expect(screen.getByText("10 de 12 itens na barra lateral")).toBeInTheDocument();
  });

  it("o preset de eventos troca todas as respostas de uma vez", () => {
    render(<PersonalizacaoSection />);

    fireEvent.click(screen.getByRole("button", { name: "Assessoria de eventos" }));

    expect(menu()).toEqual([
      "Dashboard",
      "Financeiro",
      "Clientes",
      "Projetos",
      "Agenda",
      "Equipe",
      "Documentos",
      "Notificações",
      "Analytics",
      "AI Hub",
    ]);
    expect(
      screen.getByRole("button", { name: "Assessoria de eventos" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Loja de roupa" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("mexer numa resposta tira o preset selecionado", () => {
    render(<PersonalizacaoSection />);

    expect(screen.getByRole("button", { name: "Loja de roupa" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Tem equipe ou trabalha sozinho/ })
    );

    expect(screen.getByRole("button", { name: "Loja de roupa" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(
      screen.getByRole("button", { name: "Assessoria de eventos" })
    ).toHaveAttribute("aria-pressed", "false");
    expect(menu()).toContain("Equipe");
  });

  it("o interruptor reflete a resposta no aria-pressed", () => {
    render(<PersonalizacaoSection />);
    const botao = screen.getByRole("button", {
      name: /Precisa guardar contratos e documentos/,
    });

    expect(botao).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(botao);
    expect(botao).toHaveAttribute("aria-pressed", "false");
  });
});

/**
 * Landing — composição: as dez seções na ordem, os CTAs apontando para as
 * rotas que existem no projeto (/registro e /login) e o rodapé.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/api", async () => {
  const real = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...real, api: { get: vi.fn(() => new Promise(() => {})) } };
});

import { Landing } from "./Landing";

describe("Landing", () => {
  it("renderiza as seções da página", () => {
    render(<Landing />);

    expect(
      screen.getByRole("heading", {
        name: "Um sistema onde a venda, o estoque e o caixa andam juntos",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Onde a conta costuma não fechar")).toBeInTheDocument();
    expect(
      screen.getByText("O caminho de uma venda dentro do sistema")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Onze módulos, e você escolhe quais usar")
    ).toBeInTheDocument();
    expect(
      screen.getByText("A inteligência artificial trabalha com os seus dados")
    ).toBeInTheDocument();
    expect(
      screen.getByText("O cadastro faz seis perguntas e monta o sistema a partir delas")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Dois negócios usam o Synapse todos os dias")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Os três planos vêm com o sistema completo")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Perguntas frequentes" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Comece pelo próximo lançamento e veja o sistema seguir sozinho"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("© 2026 Synapse")).toBeInTheDocument();
  });

  it("os CTAs levam para /registro e o menu para /login", () => {
    render(<Landing />);

    const cadastros = screen.getAllByRole("link", { name: /Criar conta/ });
    expect(cadastros.length).toBeGreaterThanOrEqual(2);
    cadastros.forEach((a) => expect(a).toHaveAttribute("href", "/registro"));

    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "/login"
    );
    screen
      .getAllByRole("link", { name: "Começar" })
      .forEach((a) => expect(a).toHaveAttribute("href", "/registro"));
  });

  it("a seção de prova pode ser desligada", () => {
    render(<Landing mostrarProva={false} />);
    expect(
      screen.queryByText("Dois negócios usam o Synapse todos os dias")
    ).not.toBeInTheDocument();
    // O resto da página continua
    expect(
      screen.getByRole("heading", { name: "Perguntas frequentes" })
    ).toBeInTheDocument();
  });
});

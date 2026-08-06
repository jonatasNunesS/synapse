/**
 * Landing — FAQ em <details>/<summary>: abre e fecha, e cada pergunta é
 * independente das outras.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FaqSection } from "./FaqSection";

function detalhe(pergunta: string): HTMLDetailsElement {
  return screen
    .getByText(pergunta)
    .closest("details") as HTMLDetailsElement;
}

describe("Landing — FAQ", () => {
  it("começa com todas as perguntas fechadas", () => {
    render(<FaqSection />);
    document
      .querySelectorAll("details")
      .forEach((d) => expect(d.open).toBe(false));
  });

  it("clicar na pergunta abre e clicar de novo fecha", () => {
    render(<FaqSection />);
    const item = detalhe("É mais um sistema complicado?");

    fireEvent.click(screen.getByText("É mais um sistema complicado?"));
    expect(item.open).toBe(true);

    fireEvent.click(screen.getByText("É mais um sistema complicado?"));
    expect(item.open).toBe(false);
  });

  it("abrir uma pergunta não mexe nas outras", () => {
    render(<FaqSection />);

    fireEvent.click(screen.getByText("Como funciona o suporte?"));

    expect(detalhe("Como funciona o suporte?").open).toBe(true);
    expect(detalhe("É mais um sistema complicado?").open).toBe(false);
  });

  it("a resposta está no documento junto da pergunta", () => {
    render(<FaqSection />);
    expect(
      screen.getByText(/O cadastro tem três etapas e já sai configurado/)
    ).toBeInTheDocument();
  });
});

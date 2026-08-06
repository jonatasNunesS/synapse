/**
 * Landing — planos: preço vem do backend, mas a seção nunca depende dele.
 * Sem preço definido (ou com a API fora do ar) o cartão mostra "preço a definir".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PlanosSection } from "./PlanosSection";

const get = vi.fn();
vi.mock("@/lib/api", async () => {
  const real = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...real, api: { get: (...args: unknown[]) => get(...args) } };
});

function plano(nome: string, extras: Record<string, unknown> = {}) {
  return {
    plano: nome,
    preco_mensal: null,
    preco_anual: null,
    limite_usuarios: null,
    limite_armazenamento_gb: null,
    descricao_suporte: "",
    ativo: true,
    ...extras,
  };
}

beforeEach(() => get.mockClear());

describe("Landing — planos", () => {
  it("preço null renderiza 'preço a definir' nos três cartões", async () => {
    get.mockResolvedValue({
      success: true,
      data: [plano("starter"), plano("pro"), plano("business")],
    });
    render(<PlanosSection />);

    await waitFor(() => expect(get).toHaveBeenCalledWith("/planos/"));
    expect(screen.getAllByText("preço a definir")).toHaveLength(3);
  });

  it("com preço definido mostra o valor em reais (mensal e anual)", async () => {
    get.mockResolvedValue({
      success: true,
      data: [
        plano("starter", { preco_mensal: "49.90" }),
        plano("pro", { preco_mensal: "97.00", preco_anual: "970.00" }),
        plano("business"),
      ],
    });
    render(<PlanosSection />);

    await waitFor(() =>
      expect(screen.getByText(/R\$\s?49,90 por mês/)).toBeInTheDocument()
    );
    expect(screen.getByText(/R\$\s?97,00 por mês · R\$\s?970,00 por ano/)).toBeInTheDocument();
    // O que continua sem preço segue como "a definir"
    expect(screen.getAllByText("preço a definir")).toHaveLength(1);
  });

  it("limites e suporte só aparecem quando definidos", async () => {
    get.mockResolvedValue({
      success: true,
      data: [
        plano("starter", {
          limite_usuarios: 3,
          limite_armazenamento_gb: 5,
          descricao_suporte: "WhatsApp em horário comercial",
        }),
        plano("pro"),
        plano("business"),
      ],
    });
    render(<PlanosSection />);

    await waitFor(() =>
      expect(screen.getByText("Até 3 usuários")).toBeInTheDocument()
    );
    expect(screen.getByText("5 GB de armazenamento")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp em horário comercial")).toBeInTheDocument();
    // O Pro não recebeu limites: nada de "Até" no cartão dele
    expect(screen.getAllByText(/Até \d+ usuário/)).toHaveLength(1);
  });
});

/**
 * Painel Admin — Planos e Preços: carrega os três planos, salva o que o staff
 * digitou e trata campo vazio como "a definir" (null no backend).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlanosPrecosSection } from "./PlanosPrecosSection";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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

const get = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/api", async () => {
  const real = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...real,
    api: {
      get: (...a: unknown[]) => get(...a),
      patch: (...a: unknown[]) => patch(...a),
    },
  };
});

beforeEach(() => {
  get.mockClear();
  patch.mockClear();
  get.mockResolvedValue({
    success: true,
    data: [
      plano("starter"),
      plano("pro", { preco_mensal: "97.00" }),
      plano("business"),
    ],
  });
  patch.mockImplementation((_url: string, body: Record<string, unknown>) =>
    Promise.resolve({ success: true, data: plano("starter", body) })
  );
});

describe("Painel Admin — Planos e Preços", () => {
  it("lista os três planos com o que já está definido", async () => {
    render(<PlanosPrecosSection />);

    await waitFor(() => expect(get).toHaveBeenCalledWith("/planos/"));
    expect(await screen.findByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Business")).toBeInTheDocument();
    // Pro já tem preço; Starter continua em branco (a definir)
    expect(screen.getByLabelText(/Preço mensal/, { selector: "#mensal-pro" })).toHaveValue(
      "97.00"
    );
    expect(
      screen.getByLabelText(/Preço mensal/, { selector: "#mensal-starter" })
    ).toHaveValue("");
  });

  it("salva preço, limites e suporte do plano editado", async () => {
    render(<PlanosPrecosSection />);
    await screen.findByText("Starter");

    fireEvent.change(
      screen.getByLabelText(/Preço mensal/, { selector: "#mensal-starter" }),
      { target: { value: "49.90" } }
    );
    fireEvent.change(
      screen.getByLabelText(/Limite de usuários/, { selector: "#usuarios-starter" }),
      { target: { value: "3" } }
    );
    fireEvent.change(
      screen.getByLabelText(/Descrição do suporte/, { selector: "#suporte-starter" }),
      { target: { value: "WhatsApp comercial" } }
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Salvar" })[0]);

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/painel-admin/planos/starter/", {
        preco_mensal: "49.90",
        preco_anual: null,
        limite_usuarios: "3",
        limite_armazenamento_gb: null,
        descricao_suporte: "WhatsApp comercial",
      })
    );
  });

  it("campo limpo volta a ser null (a definir)", async () => {
    render(<PlanosPrecosSection />);
    await screen.findByText("Pro");

    fireEvent.change(
      screen.getByLabelText(/Preço mensal/, { selector: "#mensal-pro" }),
      { target: { value: "" } }
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Salvar" })[1]);

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        "/painel-admin/planos/pro/",
        expect.objectContaining({ preco_mensal: null })
      )
    );
  });
});

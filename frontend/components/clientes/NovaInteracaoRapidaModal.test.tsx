/**
 * Atalho de nova interação: com cliente fixo abre o form direto; registrar uma
 * ligação chama registrar e dá o toast "para {cliente}".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NovaInteracaoRapidaModal } from "./NovaInteracaoRapidaModal";

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: vi.fn() },
}));

const registrar = vi.fn().mockResolvedValue({ id: "i1", tipo: "ligacao" });
vi.mock("@/hooks/useClientes", () => ({
  useInteracoes: () => ({ registrar, registrarFinanceiro: vi.fn() }),
  useClientes: () => ({ clientes: [], loading: false, carregar: vi.fn() }),
}));
vi.mock("@/hooks/useEstoque", () => ({
  useProdutos: () => ({ produtos: [], loading: false, listar: vi.fn() }),
}));

beforeEach(() => {
  toastSuccess.mockClear();
  registrar.mockClear();
});

describe("NovaInteracaoRapidaModal", () => {
  it("com cliente fixo abre o formulário de interação direto", () => {
    render(
      <NovaInteracaoRapidaModal
        clienteInicial={{ id: "c1", nome: "Ana & João" }}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Registrar Interação")).toBeInTheDocument();
  });

  it("sem cliente fixo pede para escolher o cliente", () => {
    render(<NovaInteracaoRapidaModal clienteInicial={null} onClose={vi.fn()} />);
    expect(screen.getByText("Para qual cliente?")).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar cliente")).toBeInTheDocument();
  });

  it("registrar uma ligação chama registrar e dá toast com o nome do cliente", async () => {
    const onClose = vi.fn();
    render(
      <NovaInteracaoRapidaModal
        clienteInicial={{ id: "c1", nome: "Ana & João" }}
        onClose={onClose}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/Ligação de apresentação/), {
      target: { value: "Ligação de follow-up" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Registrar/ }));
    await waitFor(() => expect(registrar).toHaveBeenCalled());
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Interação registrada para Ana & João")
    );
  });
});

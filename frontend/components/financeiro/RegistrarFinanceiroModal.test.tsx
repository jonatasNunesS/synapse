/**
 * RegistrarFinanceiroModal (compra→despesa / venda→receita):
 * confirma chamando o registrar; se já registrado, mostra aviso e não oferece.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RegistrarFinanceiroModal } from "./RegistrarFinanceiroModal";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
});

describe("RegistrarFinanceiroModal", () => {
  it("despesa: mostra valor/fornecedor e confirma chamando registrar", async () => {
    const registrar = vi.fn().mockResolvedValue({});
    render(
      <RegistrarFinanceiroModal
        tipo="despesa" valor="500.00" contraparteLabel="Fornecedor"
        contraparteNome="Tecido SA" registrar={registrar}
        onClose={vi.fn()} onSuccess={vi.fn()}
      />
    );
    expect(screen.getByText("Deseja registrar no financeiro?")).toBeInTheDocument();
    expect(screen.getByText(/Tecido SA/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sim, registrar despesa/ }));
    await waitFor(() => expect(registrar).toHaveBeenCalled());
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Despesa registrada no financeiro.")
    );
  });

  it("receita: confirma chamando registrar", async () => {
    const registrar = vi.fn().mockResolvedValue({});
    render(
      <RegistrarFinanceiroModal
        tipo="receita" valor="300.00" contraparteLabel="Cliente"
        contraparteNome="Ana" registrar={registrar}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Sim, registrar receita/ }));
    await waitFor(() => expect(registrar).toHaveBeenCalled());
  });

  it("já registrado: mostra aviso e não oferece registrar", () => {
    const registrar = vi.fn();
    render(
      <RegistrarFinanceiroModal
        tipo="despesa" valor="500.00" contraparteLabel="Fornecedor"
        contraparteNome="Tecido SA" jaRegistrado registrar={registrar}
        onClose={vi.fn()}
      />
    );
    expect(
      screen.getByText("Esta compra já tem lançamento financeiro.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Sim, registrar/ })
    ).not.toBeInTheDocument();
  });
});

/**
 * Testes do form de recorrência: valida campos obrigatórios antes de submeter.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/hooks/useFinanceiro", () => ({
  useCategorias: () => ({ categorias: [] }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { RecorrenciaForm } from "./RecorrenciaForm";

describe("RecorrenciaForm", () => {
  it("não submete e mostra erros quando título e valor estão vazios", async () => {
    const onSubmit = vi.fn();
    render(<RecorrenciaForm onClose={() => {}} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText("Criar recorrência"));

    await waitFor(() => {
      expect(screen.getByText("Título é obrigatório.")).toBeInTheDocument();
    });
    expect(screen.getByText("Informe um valor positivo.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submete quando os obrigatórios estão preenchidos", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RecorrenciaForm onClose={() => {}} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText("Ex: Salário Patrícia"), {
      target: { value: "Aluguel" },
    });
    fireEvent.change(screen.getByPlaceholderText("0,00"), {
      target: { value: "1500" },
    });
    fireEvent.click(screen.getByText("Criar recorrência"));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: "Aluguel", valor_padrao: "1500" })
    );
  });
});

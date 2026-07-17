/**
 * Testes do LancamentoForm — campos condicionais de empréstimo.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LancamentoForm } from "./LancamentoForm";

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <LancamentoForm categorias={[]} onSubmit={onSubmit} onClose={vi.fn()} />
  );
  return onSubmit;
}

describe("LancamentoForm — empréstimo", () => {
  it("campos de empréstimo só aparecem quando tipo=Empréstimo", () => {
    renderForm();
    // Antes de selecionar: sem campos de empréstimo
    expect(screen.queryByText("Direção *")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Empréstimo" }));

    expect(screen.getByText("Direção *")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eu emprestei" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Peguei emprestado" })
    ).toBeInTheDocument();
    expect(screen.getByText("Data de retorno esperado *")).toBeInTheDocument();
    // E some o bloco de status/recorrência
    expect(screen.queryByText("Lançamento recorrente")).not.toBeInTheDocument();
  });

  it("submete empréstimo com direção, pessoa e data de retorno", async () => {
    const onSubmit = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Empréstimo" }));

    fireEvent.change(screen.getByPlaceholderText(/Venda de produto/), {
      target: { value: "Empréstimo pro João" },
    });
    fireEvent.change(screen.getByPlaceholderText("0,00"), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Eu emprestei" }));
    fireEvent.change(screen.getByPlaceholderText("Ex: João da padaria"), {
      target: { value: "João" },
    });
    // data de retorno (único input type=date visível no modo empréstimo)
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-08-01" } });

    fireEvent.click(screen.getByRole("button", { name: /Salvar Lançamento/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.tipo).toBe("emprestimo");
    expect(payload.direcao_emprestimo).toBe("emprestei");
    expect(payload.pessoa_emprestimo).toBe("João");
    expect(payload.data_retorno_esperado).toBe("2026-08-01");
    expect(payload.valor).toBe(500);
  });

  it("bloqueia submit de empréstimo sem direção", async () => {
    const onSubmit = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Empréstimo" }));
    fireEvent.change(screen.getByPlaceholderText(/Venda de produto/), {
      target: { value: "Empréstimo X" },
    });
    fireEvent.change(screen.getByPlaceholderText("0,00"), {
      target: { value: "500" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ex: João da padaria"), {
      target: { value: "João" },
    });
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-08-01" } });

    fireEvent.click(screen.getByRole("button", { name: /Salvar Lançamento/ }));

    await waitFor(() =>
      expect(screen.getByText("Escolha a direção do empréstimo.")).toBeInTheDocument()
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

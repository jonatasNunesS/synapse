/**
 * Testes do modal de ação de empréstimo: botões por direção e adiar.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EmprestimoAcaoModal } from "./EmprestimoAcaoModal";
import type { Lancamento } from "@/types/financeiro";

function emprestimo(direcao: "emprestei" | "peguei_emprestado"): Lancamento {
  return {
    id: "e1",
    tipo: "emprestimo",
    descricao: "Emp",
    valor: 500,
    categoria: null,
    categoria_nome: null,
    categoria_cor: null,
    data_vencimento: "2026-08-01",
    data_pagamento: "2026-07-10",
    status: "pago",
    recorrente: false,
    recorrencia: "",
    observacoes: "",
    esta_atrasado: false,
    direcao_emprestimo: direcao,
    direcao_emprestimo_display: direcao === "emprestei" ? "Eu emprestei" : "Peguei emprestado",
    pessoa_emprestimo: "João",
    data_retorno_esperado: "2026-08-01",
    emprestimo_quitado: false,
    emprestimo_perdoado: false,
    data_quitacao: null,
    status_emprestimo: "aberto",
    criado_em: "2026-07-10T10:00:00Z",
    atualizado_em: "2026-07-10T10:00:00Z",
  };
}

describe("EmprestimoAcaoModal", () => {
  it("direção 'emprestei' mostra Recebeu / Adiar / Perdoar", () => {
    render(
      <EmprestimoAcaoModal
        emprestimo={emprestimo("emprestei")}
        onQuitar={vi.fn()}
        onAdiar={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/ficou de te devolver/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recebeu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Perdoar dívida" })).toBeInTheDocument();
  });

  it("direção 'peguei_emprestado' mostra Devolvi / Dívida cancelada", () => {
    render(
      <EmprestimoAcaoModal
        emprestimo={emprestimo("peguei_emprestado")}
        onQuitar={vi.fn()}
        onAdiar={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/Você ficou de devolver/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Devolvi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dívida cancelada" })).toBeInTheDocument();
  });

  it("Recebeu chama onQuitar(id, false)", async () => {
    const onQuitar = vi.fn().mockResolvedValue(undefined);
    render(
      <EmprestimoAcaoModal
        emprestimo={emprestimo("emprestei")}
        onQuitar={onQuitar}
        onAdiar={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Recebeu" }));
    await waitFor(() => expect(onQuitar).toHaveBeenCalledWith("e1", false));
  });

  it("Perdoar chama onQuitar(id, true)", async () => {
    const onQuitar = vi.fn().mockResolvedValue(undefined);
    render(
      <EmprestimoAcaoModal
        emprestimo={emprestimo("emprestei")}
        onQuitar={onQuitar}
        onAdiar={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Perdoar dívida" }));
    await waitFor(() => expect(onQuitar).toHaveBeenCalledWith("e1", true));
  });

  it("Adiar coleta os dias e chama onAdiar", async () => {
    const onAdiar = vi.fn().mockResolvedValue(undefined);
    render(
      <EmprestimoAcaoModal
        emprestimo={emprestimo("emprestei")}
        onQuitar={vi.fn()}
        onAdiar={onAdiar}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Adiar prazo" }));
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /Adiar 10 dias/ }));
    await waitFor(() => expect(onAdiar).toHaveBeenCalledWith("e1", 10));
  });
});

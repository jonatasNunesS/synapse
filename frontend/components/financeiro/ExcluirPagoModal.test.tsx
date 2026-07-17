/**
 * Testes do fluxo auditado de exclusão de lançamento PAGO.
 * Cobre: aviso de impacto, confirmação por digitação da descrição exata
 * e motivo obrigatório — o botão só destrava com os dois corretos.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExcluirPagoModal } from "./ExcluirPagoModal";
import type { Lancamento } from "@/types/financeiro";

const lancamentoPago: Lancamento = {
  id: "l1",
  tipo: "receita",
  descricao: "Venda equipamento X",
  valor: 5000,
  categoria: null,
  categoria_nome: null,
  categoria_cor: null,
  data_vencimento: "2026-07-10",
  data_pagamento: "2026-07-12",
  status: "pago",
  recorrente: false,
  recorrencia: "",
  observacoes: "",
  esta_atrasado: false,
  direcao_emprestimo: null,
  direcao_emprestimo_display: null,
  pessoa_emprestimo: null,
  data_retorno_esperado: null,
  emprestimo_quitado: false,
  emprestimo_perdoado: false,
  data_quitacao: null,
  status_emprestimo: "",
  criado_em: "2026-07-10T10:00:00Z",
  atualizado_em: "2026-07-10T10:00:00Z",
};

function renderModal(onConfirm = vi.fn()) {
  render(
    <ExcluirPagoModal
      lancamento={lancamentoPago}
      onConfirm={onConfirm}
      onClose={vi.fn()}
    />
  );
  return {
    onConfirm,
    inputNome: screen.getByPlaceholderText("Digite a descrição do lançamento"),
    inputMotivo: screen.getByPlaceholderText(/lançamento duplicado/i),
    botao: screen.getByText("Excluir definitivamente").closest("button")!,
  };
}

describe("ExcluirPagoModal", () => {
  it("mostra o aviso de impacto sobre saldos e auditoria", () => {
    renderModal();
    expect(
      screen.getByText("Esta exclusão afeta saldos e análises já geradas.")
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("botão desabilitado sem digitar a descrição exata", () => {
    const { inputMotivo, botao } = renderModal();
    fireEvent.change(inputMotivo, {
      target: { value: "Lançamento duplicado no sistema" },
    });
    expect(botao).toBeDisabled(); // nome não digitado
  });

  it("botão desabilitado com descrição certa mas motivo curto", () => {
    const { inputNome, inputMotivo, botao } = renderModal();
    fireEvent.change(inputNome, { target: { value: "Venda equipamento X" } });
    fireEvent.change(inputMotivo, { target: { value: "dup" } });
    expect(botao).toBeDisabled();
  });

  it("descrição exata + motivo válido destravam e disparam onConfirm", () => {
    const { onConfirm, inputNome, inputMotivo, botao } = renderModal(
      vi.fn().mockResolvedValue(undefined)
    );
    fireEvent.change(inputNome, { target: { value: "Venda equipamento X" } });
    fireEvent.change(inputMotivo, {
      target: { value: "Lançamento duplicado no sistema" },
    });
    expect(botao).not.toBeDisabled();

    fireEvent.click(botao);
    expect(onConfirm).toHaveBeenCalledWith("Lançamento duplicado no sistema");
  });

  it("descrição errada mantém o botão travado", () => {
    const { inputNome, inputMotivo, botao } = renderModal();
    fireEvent.change(inputNome, { target: { value: "Venda equipamento Y" } });
    fireEvent.change(inputMotivo, {
      target: { value: "Lançamento duplicado no sistema" },
    });
    expect(botao).toBeDisabled();
  });
});

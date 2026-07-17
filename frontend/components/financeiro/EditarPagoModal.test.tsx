/**
 * Testes do fluxo auditado de edição de lançamento PAGO.
 * Cobre: as 3 etapas do wizard (form → aviso de impacto → motivo),
 * o aviso âmbar de impacto, e o botão salvar desabilitado até o
 * motivo ter 5+ caracteres.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditarPagoModal } from "./EditarPagoModal";
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

function renderModal(onSubmit = vi.fn()) {
  render(
    <EditarPagoModal
      lancamento={lancamentoPago}
      categorias={[]}
      onSubmit={onSubmit}
      onClose={vi.fn()}
    />
  );
  return onSubmit;
}

function irParaEtapa2() {
  fireEvent.click(screen.getByText("Avançar"));
}

function irParaEtapa3() {
  irParaEtapa2();
  fireEvent.click(screen.getByText("Avançar"));
}

describe("EditarPagoModal", () => {
  it("etapa 1 mostra o formulário preenchido com os dados do lançamento", () => {
    renderModal();
    expect(screen.getByText("Editar lançamento pago")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Venda equipamento X")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5000")).toBeInTheDocument();
  });

  it("etapa 2 exibe o aviso de impacto (âmbar) com saldo e análises", () => {
    renderModal();
    irParaEtapa2();
    expect(
      screen.getByText("Editar um lançamento pago afeta:")
    ).toBeInTheDocument();
    expect(screen.getByText("Saldo acumulado da empresa")).toBeInTheDocument();
    expect(
      screen.getByText("Análises financeiras já geradas para este período")
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("etapa 3 mantém salvar desabilitado até o motivo ter 5+ caracteres", () => {
    renderModal();
    irParaEtapa3();

    const salvar = screen.getByText("Salvar alteração").closest("button")!;
    expect(salvar).toBeDisabled();

    const motivo = screen.getByPlaceholderText(/corrigir valor digitado errado/i);
    fireEvent.change(motivo, { target: { value: "erro" } }); // 4 chars
    expect(salvar).toBeDisabled();

    fireEvent.change(motivo, { target: { value: "Corrigi valor errado" } });
    expect(salvar).not.toBeDisabled();
  });

  it("salvar envia os dados editados junto com o motivo", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderModal(onSubmit);

    fireEvent.change(screen.getByDisplayValue("5000"), {
      target: { value: "500" },
    });
    irParaEtapa3();
    fireEvent.change(
      screen.getByPlaceholderText(/corrigir valor digitado errado/i),
      { target: { value: "Corrigi valor digitado errado" } }
    );
    fireEvent.click(screen.getByText("Salvar alteração"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [dados, motivo] = onSubmit.mock.calls[0];
    expect(dados.valor).toBe(500);
    expect(motivo).toBe("Corrigi valor digitado errado");
  });

  it("botão Voltar retorna à etapa anterior", () => {
    renderModal();
    irParaEtapa2();
    fireEvent.click(screen.getByText("Voltar"));
    expect(screen.getByDisplayValue("Venda equipamento X")).toBeInTheDocument();
  });
});

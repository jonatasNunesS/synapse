/**
 * Testes da LancamentoTable — visibilidade dos botões do fluxo auditado.
 * Regra: editar/excluir lançamento PAGO só habilitado para admin;
 * não-admin vê o botão desabilitado com tooltip explicativo.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LancamentoTable } from "./LancamentoTable";
import type { Lancamento } from "@/types/financeiro";

function lanc(status: Lancamento["status"]): Lancamento {
  return {
    id: `l-${status}`,
    tipo: "receita",
    descricao: `Lançamento ${status}`,
    valor: 100,
    categoria: null,
    categoria_nome: null,
    categoria_cor: null,
    data_vencimento: "2026-07-10",
    data_pagamento: status === "pago" ? "2026-07-12" : null,
    status,
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
}

const handlers = {
  onPagar: vi.fn(),
  onEditar: vi.fn(),
  onDeletar: vi.fn(),
  onHistorico: vi.fn(),
};

describe("LancamentoTable — fluxo auditado de pagos", () => {
  it("admin vê o botão de editar pago habilitado", () => {
    render(
      <LancamentoTable lancamentos={[lanc("pago")]} isAdmin {...handlers} />
    );
    const editar = screen.getByTitle("Editar pagamento (com auditoria)");
    expect(editar).not.toBeDisabled();
  });

  it("não-admin vê o botão de editar pago desabilitado com tooltip", () => {
    render(
      <LancamentoTable
        lancamentos={[lanc("pago")]}
        isAdmin={false}
        {...handlers}
      />
    );
    const editar = screen.getByTitle("Só administradores podem editar pagamentos");
    expect(editar).toBeDisabled();
  });

  it("não-admin vê o botão de excluir pago desabilitado com tooltip", () => {
    render(
      <LancamentoTable
        lancamentos={[lanc("pago")]}
        isAdmin={false}
        {...handlers}
      />
    );
    const excluir = screen.getByTitle(
      "Só administradores podem excluir pagamentos"
    );
    expect(excluir).toBeDisabled();
  });

  it("lançamento pendente não mostra botão de editar (fluxo atual mantido)", () => {
    render(
      <LancamentoTable lancamentos={[lanc("pendente")]} isAdmin {...handlers} />
    );
    expect(
      screen.queryByTitle("Editar pagamento (com auditoria)")
    ).not.toBeInTheDocument();
    // excluir pendente continua livre
    expect(screen.getByTitle("Excluir lançamento")).not.toBeDisabled();
  });

  it("botão de histórico aparece para qualquer lançamento", () => {
    render(
      <LancamentoTable
        lancamentos={[lanc("pago"), lanc("pendente")]}
        isAdmin={false}
        {...handlers}
      />
    );
    expect(screen.getAllByTitle("Histórico de alterações")).toHaveLength(2);
  });
});

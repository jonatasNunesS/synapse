/**
 * Bug B: o botão de estornar deve aparecer em TODOS os tipos de movimentação,
 * inclusive numa que já é um estorno (motivo=devolucao, referência "Estorno de").
 * Assim dá para "estornar o estorno" feito por engano.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HistoricoMovimentacoes } from "./HistoricoMovimentacoes";
import type { Movimentacao } from "@/types/estoque";

const produto = {
  id: "p1", nome: "Camisa", sku: "C-1", estoque_atual: 10, unidade: "unidade" as const,
};

function mov(over: Partial<Movimentacao>): Movimentacao {
  return {
    id: "m1", produto, variacao: null, tipo: "entrada", quantidade: 10,
    estoque_antes: 0, estoque_depois: 10, motivo: "compra", referencia: "",
    observacoes: "", criado_por_nome: "Ana", criado_em: "2026-07-22T10:00:00Z",
    ...over,
  };
}

const paginacao = { total: 2, pagina: 1, totalPaginas: 1 };

describe("HistoricoMovimentacoes — botão estornar", () => {
  it("mostra o botão de estornar em entrada e no estorno (saída/devolução)", () => {
    const entrada = mov({ id: "m1", tipo: "entrada", motivo: "compra" });
    const estorno = mov({
      id: "m2", tipo: "saida", motivo: "devolucao", quantidade: 10,
      referencia: "Estorno de m1", observacoes: "estorno por engano",
    });
    render(<HistoricoMovimentacoes movimentacoes={[entrada, estorno]} paginacao={paginacao} />);

    // Um botão "Estornar" por movimentação (título começa com "Estornar")
    const botoes = screen.getAllByTitle(/^Estornar/);
    expect(botoes.length).toBe(2);
  });
});

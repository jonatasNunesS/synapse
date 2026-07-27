/**
 * Sequência de perguntas ao apagar uma venda/compra com vínculos:
 * primeiro o estoque, depois o financeiro, e só então onFinalizar com as
 * duas escolhas. Sem vínculo, finaliza direto.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApagarComAjustesFlow } from "./ApagarComAjustesFlow";
import type { MovimentacaoInfo, LancamentoInfo } from "@/types/clientes";

const mov: MovimentacaoInfo = { id: "m1", produto_nome: "Camisa", quantidade: "3", tipo: "saida" };
const lanc: LancamentoInfo = { id: "l1", valor: "500.00", status: "pendente", tipo: "receita" };

describe("ApagarComAjustesFlow", () => {
  it("pergunta estoque PRIMEIRO, financeiro DEPOIS, e finaliza com as escolhas", async () => {
    const onFinalizar = vi.fn();
    render(
      <ApagarComAjustesFlow
        tipoFinanceiro="receita"
        movimentacaoInfo={mov}
        lancamentoInfo={lanc}
        onFinalizar={onFinalizar}
      />
    );

    // 1) Estoque primeiro
    expect(screen.getByText(/descontou do estoque/)).toBeInTheDocument();
    expect(screen.getByText(/3 un. de Camisa/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sim, estornar estoque" }));

    // 2) Depois o financeiro (ainda não finalizou)
    expect(onFinalizar).not.toHaveBeenCalled();
    expect(await screen.findByText(/tem lançamento financeiro/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sim, apagar lançamento" }));

    // 3) Finaliza com (estornarEstoque=true, apagarFinanceiro=true)
    await waitFor(() => expect(onFinalizar).toHaveBeenCalledWith(true, true));
  });

  it('"Não, manter" no estoque e no financeiro finaliza com (false, false)', async () => {
    const onFinalizar = vi.fn();
    render(
      <ApagarComAjustesFlow
        tipoFinanceiro="receita"
        movimentacaoInfo={mov}
        lancamentoInfo={lanc}
        onFinalizar={onFinalizar}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Não, manter" }));
    fireEvent.click(await screen.findByRole("button", { name: "Não, manter" }));
    await waitFor(() => expect(onFinalizar).toHaveBeenCalledWith(false, false));
  });

  it("só financeiro (sem estoque) → pula direto para a pergunta financeira", () => {
    const onFinalizar = vi.fn();
    render(
      <ApagarComAjustesFlow
        tipoFinanceiro="receita"
        movimentacaoInfo={null}
        lancamentoInfo={lanc}
        onFinalizar={onFinalizar}
      />
    );
    expect(screen.getByText(/tem lançamento financeiro/)).toBeInTheDocument();
    expect(screen.queryByText(/descontou do estoque/)).not.toBeInTheDocument();
  });

  it("sem nenhum vínculo → finaliza direto sem perguntas", async () => {
    const onFinalizar = vi.fn();
    render(
      <ApagarComAjustesFlow
        tipoFinanceiro="receita"
        movimentacaoInfo={null}
        lancamentoInfo={null}
        onFinalizar={onFinalizar}
      />
    );
    await waitFor(() => expect(onFinalizar).toHaveBeenCalledWith(false, false));
  });

  it("compra (despesa) usa o texto de entrada/compra", () => {
    render(
      <ApagarComAjustesFlow
        tipoFinanceiro="despesa"
        movimentacaoInfo={{ ...mov, tipo: "entrada" }}
        lancamentoInfo={null}
        onFinalizar={vi.fn()}
      />
    );
    expect(screen.getByText(/adicionou ao estoque/)).toBeInTheDocument();
    expect(screen.getByText(/Esta compra/)).toBeInTheDocument();
  });
});

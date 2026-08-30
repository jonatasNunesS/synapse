/**
 * As duas integrações da venda, do lado da tela.
 *
 * O que estes testes fixam é sobretudo o que a tela NÃO oferece. As vendas
 * migradas na fase 2 chegam aqui com lançamento financeiro já feito e sem item
 * de produto — oferecer as ações a elas levaria a pessoa a um clique que
 * duplicaria receita ou daria erro.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { VendaIntegracoes } from "./VendaIntegracoes";
import type { Venda } from "@/types/vendas";

const previaEstoque = vi.fn();
const baixarEstoque = vi.fn();
const lancarFinanceiro = vi.fn();

vi.mock("@/hooks/useVendas", () => ({
  vendaIntegracoes: {
    previaEstoque: (...args: unknown[]) => previaEstoque(...args),
    baixarEstoque: (...args: unknown[]) => baixarEstoque(...args),
    lancarFinanceiro: (...args: unknown[]) => lancarFinanceiro(...args),
  },
}));

const onAtualizada = vi.fn();

beforeEach(() => {
  previaEstoque.mockReset();
  baixarEstoque.mockReset();
  lancarFinanceiro.mockReset();
  onAtualizada.mockReset();
});

function venda(extra: Partial<Venda> = {}): Venda {
  return {
    id: "v-1",
    cliente: null,
    cliente_nome: null,
    data_venda: "2026-01-10",
    subtotal: "100.00",
    desconto: "0",
    total: "100.00",
    forma_pagamento: "pix",
    status_pagamento: "pago",
    data_prevista_pagamento: null,
    observacoes: "",
    itens: [],
    ja_baixou_estoque: false,
    tem_itens_com_produto: true,
    tem_lancamento_financeiro: false,
    criado_em: "2026-01-10T10:00:00Z",
    atualizado_em: "2026-01-10T10:00:00Z",
    ...extra,
  } as Venda;
}

function montar(extra: Partial<Venda> = {}) {
  render(<VendaIntegracoes venda={venda(extra)} onAtualizada={onAtualizada} />);
}

describe("Baixa de estoque — pergunta antes", () => {
  it("mostra o saldo antes e depois de cada produto, sem baixar nada", async () => {
    previaEstoque.mockResolvedValue({
      ja_baixou: false,
      tem_itens_com_produto: true,
      itens: [
        {
          item_id: "i-1",
          produto_id: "p-1",
          produto_nome: "Camisa",
          quantidade: "3",
          estoque_antes: "10",
          estoque_depois: "7",
          suficiente: true,
        },
      ],
    });
    montar();

    fireEvent.click(screen.getByRole("button", { name: /baixar do estoque/i }));

    expect(await screen.findByTestId("previa-estoque")).toBeInTheDocument();
    expect(screen.getByText("Camisa")).toBeInTheDocument();
    expect(screen.getByText("10 → 7")).toBeInTheDocument();
    // Ver a prévia não baixa: só o "Confirmar" baixa.
    expect(baixarEstoque).not.toHaveBeenCalled();
  });

  it("só baixa depois de confirmar", async () => {
    previaEstoque.mockResolvedValue({
      ja_baixou: false,
      tem_itens_com_produto: true,
      itens: [],
    });
    baixarEstoque.mockResolvedValue(venda({ ja_baixou_estoque: true }));
    montar();

    fireEvent.click(screen.getByRole("button", { name: /baixar do estoque/i }));
    fireEvent.click(await screen.findByRole("button", { name: /confirmar baixa/i }));

    await waitFor(() => expect(baixarEstoque).toHaveBeenCalledWith("v-1", false));
    expect(onAtualizada).toHaveBeenCalled();
  });

  it("estoque insuficiente: mostra o motivo e oferece baixar o que tem", async () => {
    previaEstoque.mockResolvedValue({
      ja_baixou: false,
      tem_itens_com_produto: true,
      itens: [],
    });
    baixarEstoque.mockRejectedValueOnce(
      new Error("Estoque insuficiente para um ou mais itens.")
    );
    montar();

    fireEvent.click(screen.getByRole("button", { name: /baixar do estoque/i }));
    fireEvent.click(await screen.findByRole("button", { name: /confirmar baixa/i }));

    expect(
      await screen.findByText("Estoque insuficiente para um ou mais itens.")
    ).toBeInTheDocument();

    baixarEstoque.mockResolvedValueOnce(venda({ ja_baixou_estoque: true }));
    fireEvent.click(screen.getByRole("button", { name: /só o que tem em estoque/i }));

    await waitFor(() =>
      expect(baixarEstoque).toHaveBeenLastCalledWith("v-1", true)
    );
  });
});

describe("GUARDA: item livre não baixa estoque", () => {
  it("venda sem item de produto não oferece a baixa", () => {
    // É a forma das 22 vendas migradas: só item livre.
    montar({ tem_itens_com_produto: false });

    expect(screen.getByTestId("estoque-sem-produto")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /baixar do estoque/i })
    ).not.toBeInTheDocument();
  });

  it("venda que já baixou não oferece baixar de novo", () => {
    montar({ ja_baixou_estoque: true });

    expect(screen.getByTestId("estoque-ja-baixado")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /baixar do estoque/i })
    ).not.toBeInTheDocument();
  });
});

describe("Lançamento financeiro", () => {
  it("mostra o valor que vai para o caixa antes de lançar", () => {
    montar({ total: "1200.00" });

    // O Intl separa "R$" do número com espaço não-quebrável.
    const botao = screen.getByRole("button", { name: /lançar/i });
    expect(botao.textContent?.replace(/ /g, " ")).toContain("R$ 1.200,00");
  });

  it("lança e devolve a venda atualizada", async () => {
    lancarFinanceiro.mockResolvedValue(venda({ tem_lancamento_financeiro: true }));
    montar();

    fireEvent.click(screen.getByRole("button", { name: /lançar/i }));

    await waitFor(() => expect(lancarFinanceiro).toHaveBeenCalledWith("v-1"));
    expect(onAtualizada).toHaveBeenCalled();
  });

  it("mostra o motivo quando o backend recusa", async () => {
    lancarFinanceiro.mockRejectedValue(
      new Error("Esta venda já tem lançamento financeiro.")
    );
    montar();

    fireEvent.click(screen.getByRole("button", { name: /lançar/i }));

    expect(
      await screen.findByText("Esta venda já tem lançamento financeiro.")
    ).toBeInTheDocument();
  });
});

describe("GUARDA: financeiro não duplica", () => {
  it("venda que já tem lançamento não oferece lançar de novo", () => {
    // As 22 migradas chegam assim — o lançamento veio da interação original.
    montar({ tem_lancamento_financeiro: true });

    expect(screen.getByTestId("financeiro-ja-lancado")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /lançar/i })
    ).not.toBeInTheDocument();
  });
});

describe("Uma venda migrada da fase 2", () => {
  it("não oferece nenhuma das duas ações", () => {
    // Sem produto e com lançamento: exatamente o que a migração produz.
    montar({ tem_itens_com_produto: false, tem_lancamento_financeiro: true });

    expect(screen.getByTestId("estoque-sem-produto")).toBeInTheDocument();
    expect(screen.getByTestId("financeiro-ja-lancado")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

/**
 * O cálculo da venda enquanto ela é montada na tela.
 *
 * Este cálculo existe só para a pessoa ver o total antes de salvar — o valor
 * gravado é o que o backend devolve. Ainda assim ele precisa estar certo, e
 * sobretudo precisa aguentar o que um campo de formulário produz: vazio,
 * vírgula no lugar do ponto, texto. Nada disso pode virar NaN na tela.
 */
import { describe, it, expect } from "vitest";

import {
  descontoValido,
  paraNumero,
  subtotalDaVenda,
  subtotalDoItem,
  totalDaVenda,
} from "./vendas";
import type { ItemEmEdicao } from "@/types/vendas";

function item(quantidade: string, preco: string): ItemEmEdicao {
  return {
    chave: `${quantidade}-${preco}`,
    produto: "p1",
    produto_nome: "Produto",
    quantidade,
    preco_unitario: preco,
  };
}

describe("paraNumero — o que os campos produzem", () => {
  it.each([
    ["número normal", "10.50", 10.5],
    ["vírgula decimal, como se digita", "10,50", 10.5],
    ["campo vazio", "", 0],
    ["texto", "abc", 0],
    ["nulo", null, 0],
    ["indefinido", undefined, 0],
  ])("%s", (_caso, entrada, esperado) => {
    expect(paraNumero(entrada)).toBe(esperado);
  });

  it("nunca devolve NaN", () => {
    for (const entrada of ["", "abc", null, undefined, "--", "1.2.3"]) {
      expect(Number.isNaN(paraNumero(entrada))).toBe(false);
    }
  });
});

describe("Subtotal", () => {
  it("do item é quantidade × preço", () => {
    expect(subtotalDoItem(item("2", "50.00"))).toBe(100);
  });

  it("aceita fração — quem vende por peso", () => {
    expect(subtotalDoItem(item("1.5", "10.00"))).toBe(15);
  });

  it("da venda é a soma dos itens", () => {
    expect(subtotalDaVenda([item("2", "50.00"), item("1", "30.00")])).toBe(130);
  });

  it("sem itens é zero", () => {
    expect(subtotalDaVenda([])).toBe(0);
  });
});

describe("Total = subtotal − desconto", () => {
  it("aplica o desconto", () => {
    expect(totalDaVenda([item("2", "50.00"), item("1", "30.00")], "10")).toBe(120);
  });

  it("sem desconto, total é o subtotal", () => {
    expect(totalDaVenda([item("2", "50.00")], "")).toBe(100);
  });

  it("desconto igual ao subtotal zera — brinde é legítimo", () => {
    expect(totalDaVenda([item("1", "50.00")], "50")).toBe(0);
  });

  it("não exibe total negativo enquanto a pessoa digita", () => {
    // O backend recusa esse desconto; até lá, a tela não mostra número
    // negativo, que confundiria mais do que ajudaria.
    expect(totalDaVenda([item("1", "50.00")], "80")).toBe(0);
  });

  it("editar o preço de um item muda o total", () => {
    const antes = totalDaVenda([item("2", "50.00")], "0");
    const depois = totalDaVenda([item("2", "45.00")], "0");
    expect(antes).toBe(100);
    expect(depois).toBe(90);
  });
});

describe("descontoValido — a mesma regra do backend", () => {
  it("desconto dentro do subtotal passa", () => {
    expect(descontoValido([item("1", "50.00")], "50")).toBe(true);
    expect(descontoValido([item("1", "50.00")], "10")).toBe(true);
  });

  it("desconto maior que o subtotal não passa", () => {
    expect(descontoValido([item("1", "50.00")], "51")).toBe(false);
  });

  it("sem itens, qualquer desconto acima de zero não cabe", () => {
    expect(descontoValido([], "1")).toBe(false);
    expect(descontoValido([], "0")).toBe(true);
  });
});

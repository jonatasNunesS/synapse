/**
 * O badge de pagamento da venda.
 *
 * Existe num lugar só porque três telas mostram a mesma coisa. O que estes
 * testes fixam é justamente que a regra não depende de quem pergunta: a mesma
 * venda produz o mesmo rótulo na lista e no histórico do cliente.
 */
import { describe, it, expect } from "vitest";

import { badgePagamentoVenda, temCobrancaAberta } from "./vendaStatus";
import type { Venda } from "@/types/vendas";

function venda(extra: Partial<Venda> = {}): Venda {
  return {
    status_pagamento: "pendente",
    pagamento_atrasado: false,
    dias_para_vencer: null,
    ...extra,
  } as Venda;
}

describe("badgePagamentoVenda", () => {
  it("paga é verde e não fala de prazo", () => {
    expect(badgePagamentoVenda(venda({ status_pagamento: "pago" }))).toEqual({
      label: "Pago",
      tom: "sucesso",
    });
  });

  it("cancelada diz que não se cobra mais — não é 'paga'", () => {
    // Dizer "Pago" aqui seria mentira: o dinheiro não entrou.
    expect(badgePagamentoVenda(venda({ status_pagamento: "cancelado" }))).toEqual({
      label: "Não cobrada",
      tom: "neutro",
    });
  });

  it("vencida é vermelha", () => {
    const badge = badgePagamentoVenda(
      venda({ pagamento_atrasado: true, dias_para_vencer: -2 })
    );
    expect(badge).toEqual({ label: "Atrasado", tom: "erro" });
  });

  it("vence hoje tem nome próprio", () => {
    expect(badgePagamentoVenda(venda({ dias_para_vencer: 0 })).label).toBe(
      "Vence hoje"
    );
  });

  it.each([
    [1, "Vence em 1 dia"],
    [3, "Vence em 3 dias"],
  ])("conta os dias no plural certo (%i)", (dias, esperado) => {
    expect(badgePagamentoVenda(venda({ dias_para_vencer: dias })).label).toBe(
      esperado
    );
  });

  it("pendente sem previsão diz só 'Pendente'", () => {
    // É a forma das vendas migradas na fase 2, que nunca tiveram data.
    // Inventar um prazo para elas seria pior do que não ter prazo.
    expect(badgePagamentoVenda(venda({ dias_para_vencer: null }))).toEqual({
      label: "Pendente",
      tom: "alerta",
    });
  });
});

describe("temCobrancaAberta — quem recebe as três ações", () => {
  it.each([
    ["pendente", true],
    ["pago", false],
    ["cancelado", false],
  ] as const)("%s → %s", (status, esperado) => {
    expect(temCobrancaAberta(venda({ status_pagamento: status }))).toBe(esperado);
  });
});

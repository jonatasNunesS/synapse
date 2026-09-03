/**
 * Synapse — o estado de pagamento de uma venda, em uma etiqueta.
 *
 * Mora aqui porque três telas mostram a mesma coisa: a lista de Vendas, o
 * histórico do cliente e o detalhe. Cada uma calculando por conta própria é
 * como os três acabariam discordando — e um badge que diz "Pago" ao lado de
 * uma cobrança em aberto é pior do que badge nenhum.
 *
 * A regra é a mesma que a interação já usava: pago, cancelado, atrasado,
 * vence hoje, vence em N dias.
 */
import type { Venda } from "@/types/vendas";

export interface BadgePagamento {
  label: string;
  /** Papel semântico — quem pinta é a tela, com as classes dela. */
  tom: "sucesso" | "alerta" | "erro" | "neutro";
}

export function badgePagamentoVenda(
  venda: Pick<
    Venda,
    "status_pagamento" | "pagamento_atrasado" | "dias_para_vencer"
  >
): BadgePagamento {
  if (venda.status_pagamento === "pago") {
    return { label: "Pago", tom: "sucesso" };
  }
  if (venda.status_pagamento === "cancelado") {
    return { label: "Não cobrada", tom: "neutro" };
  }
  if (venda.pagamento_atrasado) {
    return { label: "Atrasado", tom: "erro" };
  }

  const dias = venda.dias_para_vencer;
  if (typeof dias === "number") {
    if (dias === 0) return { label: "Vence hoje", tom: "alerta" };
    return { label: `Vence em ${dias} dia${dias === 1 ? "" : "s"}`, tom: "alerta" };
  }
  // Pendente sem previsão: é o caso das vendas migradas na fase 2, que nunca
  // tiveram data. Dizer "pendente" é honesto; inventar um prazo não seria.
  return { label: "Pendente", tom: "alerta" };
}

/** Esta venda tem cobrança em aberto? É o que decide oferecer as três ações. */
export function temCobrancaAberta(
  venda: Pick<Venda, "status_pagamento">
): boolean {
  return venda.status_pagamento === "pendente";
}

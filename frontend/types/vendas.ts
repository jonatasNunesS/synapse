/**
 * Synapse — Vendas (fase 1).
 *
 * Valores monetários vêm como string: o DRF serializa DecimalField assim para
 * não perder precisão em float. Declarar `number` aqui seria a mesma mentira
 * que já custou caro no módulo de estoque — o formatCurrency aceita os dois.
 */

export type StatusPagamentoVenda = "pago" | "pendente";

export type FormaPagamento = "dinheiro" | "pix" | "cartao" | "outro";

export const FORMAS_PAGAMENTO: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: "dinheiro", rotulo: "Dinheiro" },
  { valor: "pix", rotulo: "PIX" },
  { valor: "cartao", rotulo: "Cartão" },
  { valor: "outro", rotulo: "Outro" },
];

export interface ItemVenda {
  id: string;
  /**
   * Nulo = item livre: linha sem produto no catálogo (um serviço, ou uma
   * venda antiga migrada). Nesse caso `produto_nome` vem da descrição.
   */
  produto: string | null;
  produto_nome: string;
  produto_unidade: string;
  descricao: string;
  quantidade: string;
  preco_unitario: string;
  subtotal: string;
}

export interface Venda {
  id: string;
  /** Nulo = venda de balcão, sem cliente identificado. */
  cliente: string | null;
  cliente_nome: string | null;
  data_venda: string;
  subtotal: string;
  desconto: string;
  total: string;
  forma_pagamento: FormaPagamento | "";
  status_pagamento: StatusPagamentoVenda;
  data_prevista_pagamento: string | null;
  observacoes: string;
  itens: ItemVenda[];
  criado_em: string;
  atualizado_em: string;
}

/** Um item enquanto está sendo montado na tela, antes de virar venda. */
export interface ItemEmEdicao {
  /** Chave local da linha — o id real só existe depois de salvar. */
  chave: string;
  produto: string | null;
  produto_nome: string;
  descricao: string;
  quantidade: string;
  preco_unitario: string;
}

export interface ItemVendaPayload {
  produto: string | null;
  /**
   * Obrigatória quando não há produto — é o que dá nome à linha. Vai junto
   * mesmo com produto para não apagar a anotação de um item já gravado.
   */
  descricao: string;
  quantidade: string;
  preco_unitario: string;
}

/**
 * O que se manda ao criar/editar.
 *
 * Sem subtotal e total de propósito: quem calcula é o backend. O total que a
 * tela mostra enquanto a pessoa monta a venda é conveniência de leitura, não
 * o valor que fica gravado.
 */
export interface VendaPayload {
  cliente?: string | null;
  data_venda?: string;
  desconto?: string;
  forma_pagamento?: FormaPagamento | "";
  status_pagamento?: StatusPagamentoVenda;
  data_prevista_pagamento?: string | null;
  observacoes?: string;
  itens?: ItemVendaPayload[];
}

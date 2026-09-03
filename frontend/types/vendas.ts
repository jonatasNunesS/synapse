/**
 * Synapse — Vendas (fase 1).
 *
 * Valores monetários vêm como string: o DRF serializa DecimalField assim para
 * não perder precisão em float. Declarar `number` aqui seria a mesma mentira
 * que já custou caro no módulo de estoque — o formatCurrency aceita os dois.
 */

/** `cancelado` = fiado que se decidiu não cobrar. Não entrou dinheiro, e
 * não se cobra mais — o mesmo estado que o fluxo antigo já tinha. */
export type StatusPagamentoVenda = "pago" | "pendente" | "cancelado";

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
  /**
   * Quem ficou devendo, quando não há cliente cadastrado. Texto livre: não
   * cria cadastro, só dá nome ao fiado de balcão na hora de cobrar.
   */
  devedor: string;
  /** Quanto já entrou. O recebimento parcial soma aqui, não mexe no total. */
  valor_recebido: string;
  /** total − valor_recebido, nunca negativo. É o que ainda se cobra. */
  saldo_devedor: string;
  /** Pendente com previsão já vencida. */
  pagamento_atrasado: boolean;
  /** Dias até a previsão (negativo se venceu; null se não se aplica). */
  dias_para_vencer: number | null;
  observacoes: string;
  itens: ItemVenda[];
  /** Já gerou saída de estoque. Oferecer de novo baixaria duas vezes. */
  ja_baixou_estoque: boolean;
  /** Tem ao menos um item com produto. Sem isso não há estoque a baixar. */
  tem_itens_com_produto: boolean;
  /**
   * Já tem lançamento de receita. Vem `true` nas vendas migradas da fase 2, que
   * herdaram o lançamento da interação original — lançar de novo contaria o
   * mesmo dinheiro duas vezes.
   */
  tem_lancamento_financeiro: boolean;
  criado_em: string;
  atualizado_em: string;
}

/** Uma linha da prévia de baixa: o saldo do produto antes e depois. */
export interface PreviaEstoqueItem {
  item_id: string;
  produto_id: string;
  produto_nome: string;
  quantidade: string;
  estoque_antes: string;
  estoque_depois: string;
  suficiente: boolean;
}

export interface PreviaEstoque {
  ja_baixou: boolean;
  tem_itens_com_produto: boolean;
  itens: PreviaEstoqueItem[];
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
  /** Obrigatória quando o status é pendente: sem ela não há dia para cobrar. */
  data_prevista_pagamento?: string | null;
  devedor?: string;
  observacoes?: string;
  itens?: ItemVendaPayload[];
}

/** O que a confirmação de recebimento devolve. */
export interface ResultadoRecebimento {
  venda: Venda;
  recebido: string;
  saldo_devedor: string;
  /** false = recebeu só uma parte; a venda segue pendente pelo resto. */
  quitou: boolean;
}

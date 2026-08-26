/**
 * Synapse — o cálculo da venda no lado da tela.
 *
 * Existe para a pessoa ver o total enquanto monta a venda — nada mais. O
 * valor que fica gravado é o que o backend devolve, e é ele que a lista e o
 * detalhe exibem. Se um dia os dois discordarem, quem está errado é este
 * arquivo.
 *
 * Trabalha com string porque é o que os campos de formulário produzem e o
 * que a API troca; converter uma vez, aqui, evita `NaN` espalhado pela tela.
 */
import type { ItemEmEdicao } from "@/types/vendas";

/** Lê número de campo de formulário: vírgula decimal, vazio, lixo. */
export function paraNumero(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  const num =
    typeof valor === "string" ? Number(valor.replace(",", ".")) : valor;
  return Number.isFinite(num) ? num : 0;
}

export function subtotalDoItem(item: Pick<ItemEmEdicao, "quantidade" | "preco_unitario">): number {
  return paraNumero(item.quantidade) * paraNumero(item.preco_unitario);
}

export function subtotalDaVenda(itens: ItemEmEdicao[]): number {
  return itens.reduce((soma, item) => soma + subtotalDoItem(item), 0);
}

/**
 * Total = subtotal − desconto, sem deixar passar de negativo.
 *
 * O backend recusa desconto maior que o subtotal; aqui o piso em zero serve
 * para a tela não exibir um total negativo enquanto a pessoa digita.
 */
export function totalDaVenda(itens: ItemEmEdicao[], desconto: string | number): number {
  const subtotal = subtotalDaVenda(itens);
  return Math.max(0, subtotal - paraNumero(desconto));
}

/** O desconto cabe no subtotal? É a mesma regra que o backend aplica. */
export function descontoValido(itens: ItemEmEdicao[], desconto: string | number): boolean {
  return paraNumero(desconto) <= subtotalDaVenda(itens);
}

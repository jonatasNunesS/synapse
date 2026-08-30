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

/**
 * Uma entrada do histórico do cliente, venha de onde vier.
 *
 * O histórico mistura duas origens: as interações (ligação, reunião, e as
 * vendas do fluxo antigo que ainda não foram migradas) e as Vendas. Por isso a
 * entrada carrega `origem` — é o que decide quais ações a linha oferece.
 */
export interface EntradaHistorico {
  origem: "interacao" | "venda";
  id: string;
  /** ISO. Interação tem hora; venda tem só a data — o dia é o que ordena. */
  quando: string;
  titulo: string;
  valor: string | null;
}

/**
 * Junta interações e vendas num histórico só, do mais recente para o mais antigo.
 *
 * NÃO existe risco de a mesma venda aparecer duas vezes: o backend já tira da
 * lista de interações aquelas que a migração da fase 2 converteu em Venda. Aqui
 * é só ordenação — se a dedup mudasse de lugar, ela se perderia numa das duas
 * pontas, e por isso ela mora lá, junto do dado.
 */
export function montarHistorico(
  interacoes: { id: string; titulo: string; valor: string | null; data_interacao: string }[],
  vendas: { id: string; data_venda: string; total: string; cliente_nome: string | null }[]
): EntradaHistorico[] {
  const deInteracoes: EntradaHistorico[] = interacoes.map((i) => ({
    origem: "interacao",
    id: i.id,
    quando: i.data_interacao,
    titulo: i.titulo,
    valor: i.valor,
  }));

  const deVendas: EntradaHistorico[] = vendas.map((v) => ({
    origem: "venda",
    id: v.id,
    // Venda guarda só a data; meio-dia evita que o fuso jogue para o dia anterior.
    quando: `${v.data_venda}T12:00:00`,
    titulo: "Venda",
    valor: v.total,
  }));

  return [...deInteracoes, ...deVendas].sort(
    (a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime()
  );
}

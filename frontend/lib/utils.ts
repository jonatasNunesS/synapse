import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Marca de valor ausente. Diferente de zero — ver formatCurrency. */
export const SEM_VALOR = "—";

/**
 * Converte para número o que vier da API, ou devolve null se não for
 * possível.
 *
 * Aceita string porque é isso que chega: o DRF serializa DecimalField como
 * string (`"1234.50"`), justamente para não perder precisão em float — o
 * certo para dinheiro. Vários tipos do front declaram esses campos como
 * `number`, o que não corresponde ao que trafega.
 */
function paraNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const num = typeof valor === "string" ? Number(valor) : valor;
  return typeof num === "number" && Number.isFinite(num) ? num : null;
}

/**
 * Formata valor monetário em BRL.
 *
 * Aceita `string | number` porque a API manda decimal como string, e nunca
 * devolve "R$ NaN": valor ausente ou ilegível vira "—".
 *
 * A distinção é deliberada. Zero de verdade é informação ("não houve
 * movimento") e sai como "R$ 0,00". Valor que se perdeu no caminho é outra
 * coisa, e sai como "—" — quem olha percebe a falta em vez de ler um zero
 * que nunca existiu. Converter ausência em zero é o tipo de silêncio que
 * esconde defeito de dado.
 *
 * `compacto` encurta números grandes ("R$ 1,2 mil"), para gráficos e
 * cartões onde não cabe o valor inteiro.
 */
export function formatCurrency(
  valor: unknown,
  opcoes?: { compacto?: boolean }
): string {
  const num = paraNumero(valor);
  if (num === null) return SEM_VALOR;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    ...(opcoes?.compacto ? { notation: "compact" as const } : {}),
  }).format(num);
}

/**
 * Versão compacta, pronta para passar como referência — é o que os eixos de
 * gráfico (`tickFormatter`) esperam.
 */
export function formatCurrencyCompact(valor: unknown): string {
  return formatCurrency(valor, { compacto: true });
}

/**
 * Como formatCurrency, mas devolve null quando não há valor — para quem
 * decide não renderizar nada em vez de mostrar a marca de ausente.
 */
export function formatCurrencyOrNull(valor: unknown): string | null {
  return paraNumero(valor) === null ? null : formatCurrency(valor);
}

/**
 * Formata data no padrão brasileiro.
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(date));
}

/**
 * Formata data e hora no padrão brasileiro.
 */
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

/**
 * Trunca texto com reticências.
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

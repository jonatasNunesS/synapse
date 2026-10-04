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
 * "2026-10-05" — data pura, sem parte de hora. É o que o DRF serializa de um
 * `DateField`, e há 26 deles nos modelos (vencimento, prazo, follow-up…).
 */
const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converte o que vem da API em `Date`, tratando data pura como LOCAL.
 *
 * É o conserto do bug que fazia toda data de `DateField` aparecer um dia
 * antes. `new Date("2026-10-05")` é interpretado como meia-noite **UTC** —
 * que em São Paulo (UTC−3) é 21h do dia ANTERIOR. Então:
 *
 *     new Date("2026-10-05")  →  04/10/2026   ❌
 *     new Date("2026-01-01")  →  31/12/2025   ❌ dia e ano errados
 *
 * Uma data pura não tem fuso: "5 de outubro" é 5 de outubro onde quem lê
 * estiver. Construindo com `new Date(ano, mes-1, dia)` ela nasce à meia-noite
 * LOCAL, e a formatação devolve o dia que o backend gravou.
 *
 * String com hora (ISO completa, com `T`) já funcionava e segue intocada: ali
 * o instante é real e o fuso tem sentido (CODE_HEALTH_AUDIT, ERR-03).
 */
export function paraData(valor: string | Date): Date {
  if (valor instanceof Date) return valor;
  const m = SO_DATA.exec(valor);
  if (!m) return new Date(valor);
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

/**
 * Formata data no padrão brasileiro (dd/mm/aaaa).
 *
 * Aceita data pura do backend sem deslocar o dia — ver `paraData`.
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(paraData(date));
}

/**
 * Formata data e hora no padrão brasileiro (dd/mm/aaaa hh:mm).
 *
 * Numa data PURA não há hora para mostrar, e inventar "00:00" seria afirmar
 * uma precisão que o dado não tem — então aí sai só a data.
 */
export function formatDateTime(date: string | Date): string {
  if (typeof date === "string" && SO_DATA.test(date)) {
    return formatDate(date);
  }
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(paraData(date));
}

/**
 * Trunca texto com reticências.
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

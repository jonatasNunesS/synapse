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
 * A data de hoje como "YYYY-MM-DD", no fuso de quem está usando o sistema.
 *
 * Existe porque o atalho óbvio está errado para esta finalidade:
 *
 *     new Date().toISOString().slice(0, 10)   // ← UTC, não aqui
 *
 * `toISOString` converte para UTC. São Paulo é UTC−3, então das 21:00 à
 * meia-noite esse atalho devolve AMANHÃ — e em 31/10 às 21:30 devolve
 * `2026-11-01`, que é outro mês. Uma venda registrada no fim do expediente
 * nascia com a data do dia seguinte, saía do filtro "hoje" da lista e, pelo
 * lançamento financeiro que herda `data_venda`, entrava no mês errado do
 * fluxo de caixa.
 *
 * Aqui os componentes vêm do relógio local (`getFullYear`/`getMonth`/
 * `getDate`), que é o mesmo dia que a pessoa vê no canto da tela. O backend
 * faz a conta equivalente com `timezone.localdate()`.
 *
 * Para EXIBIR data que veio do backend, use `formatDate` — esta função é só
 * para PRODUZIR a data de hoje ao gravar.
 */
export function hojeLocal(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
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
 * Só o dia e o mês (05/10). Para listas e cartões onde o ano é óbvio.
 */
export function formatDateDiaMes(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(paraData(date));
}

/**
 * Dia com mês abreviado (05/out). Usado em timelines e kanban, onde o mês por
 * extenso não cabe mas o número sozinho fica ambíguo.
 */
export function formatDateDiaMesAbrev(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(paraData(date));
}

/**
 * Dia com mês por extenso (05 de outubro). Para quando a data é o assunto.
 */
export function formatDateDiaMesLongo(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  }).format(paraData(date));
}

/**
 * Dia, mês abreviado e hora (05/out 14:30). O formato do histórico do AI Hub.
 */
export function formatDateDiaMesHora(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(paraData(date));
}

/**
 * Mês e ano por extenso (outubro de 2026). Para agrupar por competência.
 */
export function formatMesAno(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(paraData(date));
}

/**
 * Só a hora (14:30).
 *
 * Note que aqui NÃO faz sentido receber data pura: sem hora no dado, qualquer
 * saída seria inventada. Quem chamar com data pura recebe "00:00", que é o
 * comportamento do `Date` — a responsabilidade de não chamar é de quem chama.
 */
export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(paraData(date));
}

/**
 * Trunca texto com reticências.
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

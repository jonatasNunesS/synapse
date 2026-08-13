/**
 * Synapse — preferências pessoais do usuário.
 *
 * Hoje só tamanho do texto. Diferente do tema (que é da EMPRESA e vale para a
 * equipe inteira), isto aqui é de CADA UM: acessibilidade é individual.
 *
 * A escala mexe no font-size da raiz; como o Tailwind trabalha em rem, todo o
 * resto acompanha sozinho. O que NÃO deve crescer (larguras estruturais e
 * ícones) está fixado em px no globals.css.
 */

export const TAMANHOS_VALIDOS = ["normal", "medio", "grande", "maior"] as const;

export type TamanhoFonte = (typeof TAMANHOS_VALIDOS)[number];

export interface TamanhoInfo {
  id: TamanhoFonte;
  nome: string;
  /** O mesmo valor do CSS — usado no preview, que mostra cada opção no seu tamanho. */
  escala: string;
  descricao: string;
}

export const TAMANHOS: TamanhoInfo[] = [
  { id: "normal", nome: "Normal", escala: "100%", descricao: "16px — o padrão" },
  { id: "medio", nome: "Médio", escala: "112.5%", descricao: "18px" },
  { id: "grande", nome: "Grande", escala: "125%", descricao: "20px" },
  { id: "maior", nome: "Maior", escala: "137.5%", descricao: "22px" },
];

export const TAMANHO_PADRAO: TamanhoFonte = "normal";

/** Cookie lido pelo script inline do layout, antes do primeiro paint. */
export const COOKIE_TAMANHO = "synapse_fonte_tamanho";
const UM_ANO = 60 * 60 * 24 * 365;

export function tamanhoValido(valor: unknown): TamanhoFonte {
  return TAMANHOS_VALIDOS.includes(valor as TamanhoFonte)
    ? (valor as TamanhoFonte)
    : TAMANHO_PADRAO;
}

export function infoDoTamanho(id: TamanhoFonte): TamanhoInfo {
  return TAMANHOS.find((t) => t.id === id) ?? TAMANHOS[0];
}

/** Escreve o data-attribute no <html> — o mesmo que o script inline faz. */
export function aplicarTamanhoNoDocumento(tamanho: TamanhoFonte): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.fonteTamanho = tamanho;
}

export function salvarTamanhoNoCookie(tamanho: TamanhoFonte): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_TAMANHO}=${tamanho}; path=/; max-age=${UM_ANO}; SameSite=Lax`;
}

export function limparTamanhoDoCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_TAMANHO}=; path=/; max-age=0; SameSite=Lax`;
}

/** Aplica e guarda — usado ao carregar o usuário e ao salvar a preferência. */
export function sincronizarTamanho(valor: unknown): void {
  const tamanho = tamanhoValido(valor);
  aplicarTamanhoNoDocumento(tamanho);
  salvarTamanhoNoCookie(tamanho);
}

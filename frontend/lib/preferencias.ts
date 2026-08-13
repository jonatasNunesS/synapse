/**
 * Synapse — preferências pessoais do usuário: tamanho do texto e modo
 * claro/escuro.
 *
 * Diferente do tema (que é da EMPRESA e vale para a equipe inteira), isto aqui
 * é de CADA UM: acessibilidade e conforto de leitura são individuais.
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

/* ══════════════════════════════════════════════════════════════
   Modo claro / escuro
   ══════════════════════════════════════════════════════════════ */

/** O que a pessoa escolhe. "sistema" delega ao SO. */
export const MODOS_VALIDOS = ["claro", "escuro", "sistema"] as const;

export type TemaModo = (typeof MODOS_VALIDOS)[number];

/** O que de fato é pintado na tela — "sistema" já resolvido. */
export type ModoEfetivo = "claro" | "escuro";

export interface ModoInfo {
  id: TemaModo;
  nome: string;
  descricao: string;
}

export const MODOS: ModoInfo[] = [
  { id: "claro", nome: "Claro", descricao: "Fundo claro o tempo todo" },
  { id: "escuro", nome: "Escuro", descricao: "Fundo escuro o tempo todo" },
  {
    id: "sistema",
    nome: "Sistema",
    descricao: "Acompanha o aparelho",
  },
];

export const MODO_PADRAO: TemaModo = "sistema";

export const COOKIE_MODO = "synapse_tema_modo";

/** A consulta ao SO. Uma constante só para não repetir a string. */
export const CONSULTA_SO = "(prefers-color-scheme: dark)";

export function modoValido(valor: unknown): TemaModo {
  return MODOS_VALIDOS.includes(valor as TemaModo)
    ? (valor as TemaModo)
    : MODO_PADRAO;
}

export function infoDoModo(id: TemaModo): ModoInfo {
  return MODOS.find((m) => m.id === id) ?? MODOS[2];
}

/**
 * Resolve a escolha no modo que vai para a tela.
 *
 * Precedência: escolha explícita ganha; "sistema" consulta o SO; SO não
 * detectável cai no escuro, que é o visual que o sistema sempre teve.
 */
export function resolverModo(escolha: TemaModo): ModoEfetivo {
  if (escolha === "claro" || escolha === "escuro") return escolha;
  if (typeof window === "undefined" || !window.matchMedia) return "escuro";
  return window.matchMedia(CONSULTA_SO).matches ? "escuro" : "claro";
}

/**
 * Escreve o modo no <html> — o mesmo que o script inline faz.
 *
 * Além do data-attribute, mantém a classe `.dark` em dia: alguns componentes
 * ainda usam a variante `dark:` do Tailwind, que depende dela.
 */
export function aplicarModoNoDocumento(escolha: TemaModo): ModoEfetivo {
  const efetivo = resolverModo(escolha);
  if (typeof document === "undefined") return efetivo;
  const el = document.documentElement;
  el.dataset.modo = efetivo;
  el.classList.toggle("dark", efetivo === "escuro");
  return efetivo;
}

export function salvarModoNoCookie(escolha: TemaModo): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_MODO}=${escolha}; path=/; max-age=${UM_ANO}; SameSite=Lax`;
}

/** A escolha guardada no cookie — o que o script inline leu antes do paint. */
export function lerModoDoCookie(): TemaModo {
  if (typeof document === "undefined") return MODO_PADRAO;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_MODO}=([^;]*)`)
  );
  return modoValido(m ? decodeURIComponent(m[1]) : null);
}

export function limparModoDoCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_MODO}=; path=/; max-age=0; SameSite=Lax`;
}

/** Aplica e guarda — usado ao carregar o usuário e ao salvar a preferência. */
export function sincronizarModo(valor: unknown): ModoEfetivo {
  const escolha = modoValido(valor);
  const efetivo = aplicarModoNoDocumento(escolha);
  salvarModoNoCookie(escolha);
  return efetivo;
}

/**
 * Enquanto a pessoa está em "sistema", o Synapse tem de acompanhar o SO ao
 * vivo — trocar o tema do aparelho com a aba aberta muda a tela na hora.
 * Devolve a função de cancelar; em qualquer outra escolha, não escuta nada.
 */
export function observarModoDoSistema(
  escolha: TemaModo,
  aoMudar: (efetivo: ModoEfetivo) => void
): () => void {
  if (escolha !== "sistema") return () => {};
  if (typeof window === "undefined" || !window.matchMedia) return () => {};

  const consulta = window.matchMedia(CONSULTA_SO);
  const handler = () => aoMudar(aplicarModoNoDocumento("sistema"));

  consulta.addEventListener("change", handler);
  return () => consulta.removeEventListener("change", handler);
}

/**
 * Synapse — identidade visual da empresa (white-label).
 *
 * Paletas e fontes são CURADAS: a empresa escolhe uma das opções, ninguém
 * digita hex. As cores de cada paleta vivem no CSS (globals.css, blocos
 * `[data-tema="..."]`); aqui ficam os metadados que a tela de configuração
 * mostra e os helpers que aplicam a escolha no documento.
 *
 * As cores abaixo repetem os valores do CSS de propósito: são o que aparece
 * nos swatches e no preview, antes de salvar.
 */

export const PALETAS_VALIDAS = [
  "synapse",
  "oceano",
  "floresta",
  "ambar",
  "grafite",
] as const;

export const FONTES_VALIDAS = [
  "padrao",
  "serifada",
  "geometrica",
  "plex",
  "figtree",
] as const;

export type Paleta = (typeof PALETAS_VALIDAS)[number];
export type FonteTema = (typeof FONTES_VALIDAS)[number];

export interface PaletaInfo {
  id: Paleta;
  nome: string;
  descricao: string;
  /** Os quatro tons do contrato — os mesmos do CSS. */
  primary: string;
  primaryHover: string;
  primarySubtle: string;
  ring: string;
  /** Tom claro usado no swatch para dar ideia da faixa da paleta. */
  claro: string;
  /**
   * A rampa completa, igualzinha à do CSS (`--brand-*` em globals.css).
   * Fica aqui para o preview e para os testes de acessibilidade — há um teste
   * que compara as duas fontes para elas não desandarem.
   */
  rampa: Record<number, string>;
}

export const PALETAS: PaletaInfo[] = [
  {
    id: "synapse",
    nome: "Synapse",
    descricao: "O roxo de sempre",
    primary: "#6D28D9",
    primaryHover: "#5B21B6",
    primarySubtle: "#F5F3FF",
    ring: "#A78BFA",
    claro: "#C4B5FD",
    rampa: { 50: "#F5F3FF", 100: "#EDE9FE", 200: "#DDD6FE", 300: "#C4B5FD", 400: "#A78BFA", 500: "#7C3AED", 600: "#6D28D9", 700: "#5B21B6", 800: "#4C1D95", 900: "#2E1065" },
  },
  {
    id: "oceano",
    nome: "Oceano",
    descricao: "Azul sóbrio",
    primary: "#0369A1",
    primaryHover: "#075985",
    primarySubtle: "#F0F9FF",
    ring: "#7DD3FC",
    claro: "#7DD3FC",
    rampa: { 50: "#F0F9FF", 100: "#E0F2FE", 200: "#BAE6FD", 300: "#7DD3FC", 400: "#38BDF8", 500: "#027BBA", 600: "#0369A1", 700: "#075985", 800: "#0C4A6E", 900: "#082F49" },
  },
  {
    id: "floresta",
    nome: "Floresta",
    descricao: "Verde escuro",
    primary: "#047857",
    primaryHover: "#065F46",
    primarySubtle: "#ECFDF5",
    ring: "#6EE7B7",
    claro: "#5EEAD4",
    rampa: { 50: "#ECFDF5", 100: "#D1FAE5", 200: "#A7F3D0", 300: "#5EEAD4", 400: "#2DD4BF", 500: "#04845E", 600: "#047857", 700: "#065F46", 800: "#064E3B", 900: "#022C22" },
  },
  {
    id: "ambar",
    nome: "Âmbar",
    descricao: "Terroso e quente",
    primary: "#B45309",
    primaryHover: "#92400E",
    primarySubtle: "#FFFBEB",
    ring: "#FCD34D",
    claro: "#FDBA74",
    rampa: { 50: "#FFFBEB", 100: "#FEF3C7", 200: "#FDE68A", 300: "#FDBA74", 400: "#FB923C", 500: "#BA5809", 600: "#B45309", 700: "#92400E", 800: "#78350F", 900: "#451A03" },
  },
  {
    id: "grafite",
    nome: "Grafite",
    descricao: "Neutro, sem cor de destaque",
    primary: "#334155",
    primaryHover: "#1E293B",
    primarySubtle: "#F8FAFC",
    ring: "#94A3B8",
    claro: "#94A3B8",
    rampa: { 50: "#F8FAFC", 100: "#F1F5F9", 200: "#E2E8F0", 300: "#CBD5E1", 400: "#94A3B8", 500: "#475569", 600: "#334155", 700: "#1E293B", 800: "#0F172A", 900: "#020617" },
  },
];

export interface FonteInfo {
  id: FonteTema;
  nome: string;
  descricao: string;
  /** family para o preview (o CSS real vem do next/font no layout). */
  familiaPreview: string;
}

export const FONTES: FonteInfo[] = [
  {
    id: "padrao",
    nome: "Padrão",
    descricao: "A fonte atual do sistema, em tudo",
    familiaPreview: "var(--font-inter), system-ui, sans-serif",
  },
  {
    id: "serifada",
    nome: "Serifada",
    descricao: "Títulos com serifa — ar mais editorial",
    familiaPreview: "var(--font-serifada), Georgia, serif",
  },
  {
    id: "geometrica",
    nome: "Geométrica",
    descricao: "Títulos em sans geométrica — ar mais moderno",
    familiaPreview: "var(--font-geometrica), var(--font-inter), sans-serif",
  },
  {
    id: "plex",
    nome: "IBM Plex Sans",
    descricao: "Títulos e corpo — a mesma da página pública",
    familiaPreview: "var(--font-plex), var(--font-inter), sans-serif",
  },
  {
    id: "figtree",
    nome: "Figtree",
    descricao: "Títulos e corpo — geométrica mais amigável",
    familiaPreview: "var(--font-figtree), var(--font-inter), sans-serif",
  },
];

export const PALETA_PADRAO: Paleta = "synapse";
export const FONTE_PADRAO: FonteTema = "padrao";

/** Cookie lido pelo script inline do layout, antes do primeiro paint. */
export const COOKIE_TEMA = "synapse_tema";
const UM_ANO = 60 * 60 * 24 * 365;

export interface TemaEmpresa {
  tema_paleta: Paleta;
  tema_fonte: FonteTema;
}

export function paletaValida(valor: unknown): Paleta {
  return PALETAS_VALIDAS.includes(valor as Paleta) ? (valor as Paleta) : PALETA_PADRAO;
}

export function fonteValida(valor: unknown): FonteTema {
  return FONTES_VALIDAS.includes(valor as FonteTema)
    ? (valor as FonteTema)
    : FONTE_PADRAO;
}

export function infoDaPaleta(id: Paleta): PaletaInfo {
  return PALETAS.find((p) => p.id === id) ?? PALETAS[0];
}

/**
 * Escreve os data-attributes no <html>. É o mesmo que o script inline faz —
 * aqui serve para refletir a troca na hora, sem recarregar a página.
 */
export function aplicarTemaNoDocumento(paleta: Paleta, fonte: FonteTema): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.tema = paleta;
  document.documentElement.dataset.fonte = fonte;
}

/** Guarda a escolha para o próximo carregamento já nascer na cor certa. */
export function salvarTemaNoCookie(paleta: Paleta, fonte: FonteTema): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_TEMA}=${paleta}.${fonte}; path=/; max-age=${UM_ANO}; SameSite=Lax`;
}

export function limparTemaDoCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_TEMA}=; path=/; max-age=0; SameSite=Lax`;
}

/** Aplica no documento e guarda no cookie — usado ao carregar o usuário e ao salvar. */
export function sincronizarTema(tema: Partial<TemaEmpresa> | null | undefined): void {
  const paleta = paletaValida(tema?.tema_paleta);
  const fonte = fonteValida(tema?.tema_fonte);
  aplicarTemaNoDocumento(paleta, fonte);
  salvarTemaNoCookie(paleta, fonte);
}

/**
 * Anti-flash: o script inline precisa ler o cookie e escrever data-tema/
 * data-fonte no <html> ANTES do React montar. Aqui ele é executado do mesmo
 * jeito que o navegador faz — a partir do texto que vai no HTML.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScriptTema } from "./ScriptTema";
import {
  COOKIE_MODO,
  COOKIE_TAMANHO,
  limparModoDoCookie,
  limparTamanhoDoCookie,
} from "@/lib/preferencias";
import { COOKIE_TEMA, limparTemaDoCookie } from "@/lib/tema";

/** Extrai o conteúdo do <script> e roda, como o navegador faria. */
function rodarScriptInline() {
  const html = renderToStaticMarkup(<ScriptTema />);
  const codigo = html.replace(/^<script>/, "").replace(/<\/script>$/, "");
  new Function(codigo)();
}

function comCookie(valor: string) {
  document.cookie = `${COOKIE_TEMA}=${valor}; path=/`;
}

function comTamanho(valor: string) {
  document.cookie = `${COOKIE_TAMANHO}=${valor}; path=/`;
}

function comModo(valor: string) {
  document.cookie = `${COOKIE_MODO}=${valor}; path=/`;
}

/** Finge o prefers-color-scheme do SO. */
function comSistema(escuro: boolean) {
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes("dark") ? escuro : !escuro,
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  delete document.documentElement.dataset.tema;
  delete document.documentElement.dataset.fonte;
  delete document.documentElement.dataset.fonteTamanho;
  delete document.documentElement.dataset.modo;
  document.documentElement.classList.remove("dark");
  limparTemaDoCookie();
  limparTamanhoDoCookie();
  limparModoDoCookie();
  comSistema(true);
});

describe("ScriptTema", () => {
  it("aplica a paleta e a fonte guardadas no cookie", () => {
    comCookie("oceano.serifada");
    rodarScriptInline();

    expect(document.documentElement.dataset.tema).toBe("oceano");
    expect(document.documentElement.dataset.fonte).toBe("serifada");
  });

  it("sem cookie, não escreve nada (fica o padrão Synapse)", () => {
    rodarScriptInline();

    expect(document.documentElement.dataset.tema).toBeUndefined();
    expect(document.documentElement.dataset.fonte).toBeUndefined();
  });

  it("ignora valor adulterado no cookie", () => {
    comCookie("javascript:alert(1).comic-sans");
    rodarScriptInline();

    expect(document.documentElement.dataset.tema).toBeUndefined();
    expect(document.documentElement.dataset.fonte).toBeUndefined();
  });

  it("aceita a paleta mesmo se a fonte vier inválida", () => {
    comCookie("grafite.qualquer");
    rodarScriptInline();

    expect(document.documentElement.dataset.tema).toBe("grafite");
    expect(document.documentElement.dataset.fonte).toBeUndefined();
  });

  it("aplica o tamanho do texto guardado no cookie", () => {
    comTamanho("maior");
    rodarScriptInline();

    expect(document.documentElement.dataset.fonteTamanho).toBe("maior");
  });

  it("tema e tamanho convivem: os dois cookies são lidos", () => {
    comCookie("floresta.plex");
    comTamanho("grande");
    rodarScriptInline();

    expect(document.documentElement.dataset.tema).toBe("floresta");
    expect(document.documentElement.dataset.fonte).toBe("plex");
    expect(document.documentElement.dataset.fonteTamanho).toBe("grande");
  });

  it("tamanho adulterado no cookie é ignorado", () => {
    comTamanho("gigantesco");
    rodarScriptInline();

    expect(document.documentElement.dataset.fonteTamanho).toBeUndefined();
  });

  it("sem preferência de tamanho, nada é escrito (fica o normal)", () => {
    comCookie("oceano.padrao");
    rodarScriptInline();

    expect(document.documentElement.dataset.tema).toBe("oceano");
    expect(document.documentElement.dataset.fonteTamanho).toBeUndefined();
  });

  it("aplica o modo escolhido no cookie, ignorando o SO", () => {
    comSistema(false); // SO no claro
    comModo("escuro");
    rodarScriptInline();

    expect(document.documentElement.dataset.modo).toBe("escuro");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("sem cookie de modo, consulta o SO antes do primeiro paint", () => {
    comSistema(false);
    rodarScriptInline();

    expect(document.documentElement.dataset.modo).toBe("claro");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("no modo 'sistema', quem decide é o SO", () => {
    comModo("sistema");
    comSistema(true);
    rodarScriptInline();

    expect(document.documentElement.dataset.modo).toBe("escuro");
  });

  it("modo adulterado no cookie cai na consulta ao SO", () => {
    comModo("sepia");
    comSistema(false);
    rodarScriptInline();

    expect(document.documentElement.dataset.modo).toBe("claro");
  });

  it("sem matchMedia (SO não detectável), fica escuro", () => {
    // @ts-expect-error — navegador sem suporte
    delete window.matchMedia;
    rodarScriptInline();

    expect(document.documentElement.dataset.modo).toBe("escuro");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("tema, tamanho e modo convivem: os três cookies são lidos", () => {
    comCookie("floresta.plex");
    comTamanho("grande");
    comModo("claro");
    rodarScriptInline();

    const el = document.documentElement;
    expect(el.dataset.tema).toBe("floresta");
    expect(el.dataset.fonte).toBe("plex");
    expect(el.dataset.fonteTamanho).toBe("grande");
    expect(el.dataset.modo).toBe("claro");
  });

  it("o script é síncrono e inline (sem src, sem defer)", () => {
    const html = renderToStaticMarkup(<ScriptTema />);
    expect(html.startsWith("<script>")).toBe(true);
    expect(html).not.toContain("src=");
    expect(html).not.toContain("defer");
    expect(html).not.toContain("async");
  });
});

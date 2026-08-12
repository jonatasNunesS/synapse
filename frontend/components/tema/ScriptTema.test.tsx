/**
 * Anti-flash: o script inline precisa ler o cookie e escrever data-tema/
 * data-fonte no <html> ANTES do React montar. Aqui ele é executado do mesmo
 * jeito que o navegador faz — a partir do texto que vai no HTML.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScriptTema } from "./ScriptTema";
import { COOKIE_TAMANHO, limparTamanhoDoCookie } from "@/lib/preferencias";
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

beforeEach(() => {
  delete document.documentElement.dataset.tema;
  delete document.documentElement.dataset.fonte;
  delete document.documentElement.dataset.fonteTamanho;
  limparTemaDoCookie();
  limparTamanhoDoCookie();
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

  it("o script é síncrono e inline (sem src, sem defer)", () => {
    const html = renderToStaticMarkup(<ScriptTema />);
    expect(html.startsWith("<script>")).toBe(true);
    expect(html).not.toContain("src=");
    expect(html).not.toContain("defer");
    expect(html).not.toContain("async");
  });
});

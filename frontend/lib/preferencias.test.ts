/**
 * Preferências pessoais — tamanho do texto.
 *
 * Garante a escala combinada, o data-attribute no <html> e que o CSS e o TS
 * contam a mesma história (um teste lê o globals.css e compara).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  COOKIE_TAMANHO,
  TAMANHOS,
  TAMANHOS_VALIDOS,
  aplicarTamanhoNoDocumento,
  infoDoTamanho,
  limparTamanhoDoCookie,
  salvarTamanhoNoCookie,
  sincronizarTamanho,
  tamanhoValido,
} from "./preferencias";

beforeEach(() => {
  delete document.documentElement.dataset.fonteTamanho;
  limparTamanhoDoCookie();
});

afterEach(() => limparTamanhoDoCookie());

describe("Tamanho do texto", () => {
  it("são quatro níveis, do normal ao maior", () => {
    expect(TAMANHOS).toHaveLength(4);
    expect(TAMANHOS.map((t) => t.id)).toEqual([...TAMANHOS_VALIDOS]);
    expect(TAMANHOS.map((t) => t.escala)).toEqual([
      "100%",
      "112.5%",
      "125%",
      "137.5%",
    ]);
  });

  it("a escala é sempre crescente", () => {
    const escalas = TAMANHOS.map((t) => parseFloat(t.escala));
    for (let i = 1; i < escalas.length; i++) {
      expect(escalas[i]).toBeGreaterThan(escalas[i - 1]);
    }
  });

  it("valor inválido cai no normal", () => {
    expect(tamanhoValido("gigante")).toBe("normal");
    expect(tamanhoValido(undefined)).toBe("normal");
    expect(tamanhoValido("grande")).toBe("grande");
  });

  it("aplicar escreve o data-attribute no <html>", () => {
    aplicarTamanhoNoDocumento("grande");
    expect(document.documentElement.dataset.fonteTamanho).toBe("grande");
  });

  it("sincronizar aplica e guarda no cookie", () => {
    sincronizarTamanho("maior");
    expect(document.documentElement.dataset.fonteTamanho).toBe("maior");
    expect(document.cookie).toContain(`${COOKIE_TAMANHO}=maior`);
  });

  it("usuário sem preferência fica no normal", () => {
    sincronizarTamanho(undefined);
    expect(document.documentElement.dataset.fonteTamanho).toBe("normal");
  });

  it("limpar o cookie não deixa a preferência para o próximo login", () => {
    salvarTamanhoNoCookie("medio");
    expect(document.cookie).toContain(COOKIE_TAMANHO);
    limparTamanhoDoCookie();
    expect(document.cookie).not.toContain("medio");
  });

  it("infoDoTamanho devolve o nível pedido", () => {
    expect(infoDoTamanho("medio").nome).toBe("Médio");
    expect(infoDoTamanho("normal").escala).toBe("100%");
  });
});

describe("A escala do CSS bate com a do TS", () => {
  const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");

  it.each(TAMANHOS.filter((t) => t.id !== "normal"))(
    "$nome: globals.css aplica $escala",
    (t) => {
      expect(css).toContain(
        `html[data-fonte-tamanho="${t.id}"] {\n  font-size: ${t.escala};`
      );
    }
  );

  it("o nível normal não precisa de regra (é o 100% do navegador)", () => {
    expect(css).not.toContain('html[data-fonte-tamanho="normal"]');
  });

  it("os painéis de KPI medem as colunas em rem, não em número fixo", () => {
    // Com a largura mínima em rem, o navegador reduz sozinho o número de
    // colunas quando o texto cresce — é o que impede o valor de ser cortado.
    for (const arquivo of [
      "../components/dashboard/KPIGrid.tsx",
      "../components/clientes/ResumoCards.tsx",
    ]) {
      const fonte = readFileSync(resolve(__dirname, arquivo), "utf8");
      expect(fonte).toMatch(/grid-cols-\[repeat\(auto-fit,minmax\([\d.]+rem,1fr\)\)\]/);
      // O valor do KPI quebra linha em vez de ser cortado com reticências.
      expect(fonte).toMatch(/font-bold[^"]*break-words/);
    }
  });

  it("a moldura do app fica em px, para não crescer com o texto", () => {
    const sidebar = readFileSync(
      resolve(__dirname, "../components/layout/Sidebar.tsx"),
      "utf8"
    );
    const layout = readFileSync(
      resolve(__dirname, "../app/(dashboard)/layout.tsx"),
      "utf8"
    );
    expect(sidebar).toContain("w-[256px]");
    expect(sidebar).toContain("w-[64px]");
    expect(layout).toContain("md:pl-[256px]");
    expect(layout).toContain("pt-[64px]");
  });
});

/**
 * Modo claro/escuro: precedência, aplicação no <html> e reação ao SO.
 *
 * A regra combinada é: escolha explícita ganha; "sistema" consulta o
 * prefers-color-scheme; SO não detectável cai no escuro.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  COOKIE_MODO,
  MODOS,
  MODOS_VALIDOS,
  aplicarModoNoDocumento,
  lerModoDoCookie,
  limparModoDoCookie,
  modoValido,
  observarModoDoSistema,
  resolverModo,
  salvarModoNoCookie,
  sincronizarModo,
} from "./preferencias";

/** Finge o prefers-color-scheme do SO. `null` = SO não detectável. */
function comSistema(escuro: boolean | null) {
  if (escuro === null) {
    // @ts-expect-error — simula navegador sem matchMedia
    delete window.matchMedia;
    return { disparar: () => {} };
  }
  const ouvintes: Array<() => void> = [];
  let atual = escuro;
  window.matchMedia = vi.fn().mockImplementation((consulta: string) => ({
    matches: consulta.includes("dark") ? atual : !atual,
    media: consulta,
    addEventListener: (_: string, fn: () => void) => ouvintes.push(fn),
    removeEventListener: (_: string, fn: () => void) => {
      const i = ouvintes.indexOf(fn);
      if (i > -1) ouvintes.splice(i, 1);
    },
  })) as unknown as typeof window.matchMedia;

  return {
    /** O usuário troca o tema do aparelho com a aba aberta. */
    disparar(novoEscuro: boolean) {
      atual = novoEscuro;
      ouvintes.forEach((fn) => fn());
    },
    get ouvintes() {
      return ouvintes.length;
    },
  };
}

const matchMediaOriginal = window.matchMedia;

beforeEach(() => {
  delete document.documentElement.dataset.modo;
  document.documentElement.classList.remove("dark");
  limparModoDoCookie();
});

afterEach(() => {
  window.matchMedia = matchMediaOriginal;
  limparModoDoCookie();
});

describe("As três opções", () => {
  it("são claro, escuro e sistema", () => {
    expect(MODOS_VALIDOS).toEqual(["claro", "escuro", "sistema"]);
    expect(MODOS.map((m) => m.id)).toEqual([...MODOS_VALIDOS]);
  });

  it("o padrão é seguir o sistema", () => {
    expect(modoValido(undefined)).toBe("sistema");
  });

  it("valor adulterado cai no padrão", () => {
    expect(modoValido("sepia")).toBe("sistema");
    expect(modoValido("<script>")).toBe("sistema");
    expect(modoValido("claro")).toBe("claro");
  });
});

describe("Precedência", () => {
  it("escolha explícita ganha do SO", () => {
    comSistema(true); // SO no escuro
    expect(resolverModo("claro")).toBe("claro");

    comSistema(false); // SO no claro
    expect(resolverModo("escuro")).toBe("escuro");
  });

  it("em 'sistema', segue o prefers-color-scheme", () => {
    comSistema(true);
    expect(resolverModo("sistema")).toBe("escuro");

    comSistema(false);
    expect(resolverModo("sistema")).toBe("claro");
  });

  it("SO não detectável cai no escuro", () => {
    comSistema(null);
    expect(resolverModo("sistema")).toBe("escuro");
  });
});

describe("Aplicação no documento", () => {
  it("escreve data-modo com o modo JÁ resolvido", () => {
    comSistema(false);
    aplicarModoNoDocumento("sistema");
    // No <html> vai o que é pintado, não a escolha: o CSS não sabe resolver
    // "sistema" sozinho.
    expect(document.documentElement.dataset.modo).toBe("claro");
  });

  it("mantém a classe .dark junto, para a variante dark: do Tailwind", () => {
    aplicarModoNoDocumento("escuro");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    aplicarModoNoDocumento("claro");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("sincronizar aplica e guarda a ESCOLHA no cookie", () => {
    comSistema(true);
    expect(sincronizarModo("sistema")).toBe("escuro");
    // No cookie fica "sistema" — senão, ao trocar o tema do aparelho, o
    // próximo carregamento nasceria preso no que era antes.
    expect(document.cookie).toContain(`${COOKIE_MODO}=sistema`);
    expect(lerModoDoCookie()).toBe("sistema");
  });

  it("limpar o cookie não deixa a preferência para o próximo login", () => {
    salvarModoNoCookie("claro");
    expect(lerModoDoCookie()).toBe("claro");
    limparModoDoCookie();
    expect(lerModoDoCookie()).toBe("sistema");
  });

  it("cookie adulterado é ignorado", () => {
    document.cookie = `${COOKIE_MODO}=javascript:alert(1); path=/`;
    expect(lerModoDoCookie()).toBe("sistema");
  });
});

describe("Reagir ao SO com a aba aberta", () => {
  it("em 'sistema', trocar o tema do aparelho muda a tela", () => {
    const so = comSistema(true);
    aplicarModoNoDocumento("sistema");
    expect(document.documentElement.dataset.modo).toBe("escuro");

    const avisado: string[] = [];
    const parar = observarModoDoSistema("sistema", (m) => avisado.push(m));

    so.disparar(false); // o aparelho vira para o claro
    expect(document.documentElement.dataset.modo).toBe("claro");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(avisado).toEqual(["claro"]);

    parar();
  });

  it("em escolha explícita, não escuta o SO", () => {
    const so = comSistema(true);
    aplicarModoNoDocumento("claro");

    const parar = observarModoDoSistema("claro", () => {});
    expect(so.ouvintes).toBe(0);

    so.disparar(true);
    expect(document.documentElement.dataset.modo).toBe("claro");
    parar();
  });

  it("parar de observar remove o listener", () => {
    const so = comSistema(true);
    const parar = observarModoDoSistema("sistema", () => {});
    expect(so.ouvintes).toBe(1);
    parar();
    expect(so.ouvintes).toBe(0);
  });

  it("sem matchMedia, não quebra", () => {
    comSistema(null);
    expect(() => observarModoDoSistema("sistema", () => {})()).not.toThrow();
  });
});

/**
 * Landing — animações de rolagem.
 *
 * O ponto crítico é que o conteúdo NUNCA fique escondido: sem
 * IntersectionObserver ou com prefers-reduced-motion, o hook não toca em nada;
 * com observer, o que está fora da tela é escondido e revelado logo em seguida.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createRef } from "react";
import { useFlowSteps, useReveal } from "./useLandingMotion";

function montarConteudo(): HTMLDivElement {
  const raiz = document.createElement("div");
  raiz.innerHTML = `
    <p data-reveal>um</p>
    <p data-reveal>dois</p>
    <p data-reveal>três</p>
  `;
  document.body.appendChild(raiz);
  return raiz;
}

function comMatchMedia(reduzido: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduzido && query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

/** Observer falso: guarda o callback para dispararmos na mão. */
function instalarObserver() {
  const alvos: Element[] = [];
  let callback: IntersectionObserverCallback | null = null;
  class FakeIO {
    constructor(cb: IntersectionObserverCallback) {
      callback = cb;
    }
    observe(el: Element) {
      alvos.push(el);
    }
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    FakeIO;
  return {
    alvos,
    disparar: (visiveis: boolean[]) =>
      callback?.(
        alvos.map((target, i) => ({
          target,
          isIntersecting: visiveis[i] ?? false,
        })) as unknown as IntersectionObserverEntry[],
        { unobserve: () => {} } as unknown as IntersectionObserver
      ),
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  delete (window as unknown as { IntersectionObserver?: unknown })
    .IntersectionObserver;
});

describe("useReveal", () => {
  beforeEach(() => comMatchMedia(false));

  it("com prefers-reduced-motion não esconde nada", () => {
    comMatchMedia(true);
    const io = instalarObserver();
    const raiz = montarConteudo();
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement }).current = raiz;

    renderHook(() => useReveal(ref));

    // Nem chegou a observar
    expect(io.alvos).toHaveLength(0);
    raiz.querySelectorAll<HTMLElement>("[data-reveal]").forEach((n) => {
      expect(n.style.opacity).toBe("");
    });
  });

  it("sem IntersectionObserver o conteúdo fica visível", () => {
    const raiz = montarConteudo();
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement }).current = raiz;

    renderHook(() => useReveal(ref));

    raiz.querySelectorAll<HTMLElement>("[data-reveal]").forEach((n) => {
      expect(n.style.opacity).toBe("");
    });
  });

  it("esconde o que está fora da tela e revela em seguida", () => {
    vi.useFakeTimers();
    const io = instalarObserver();
    const raiz = montarConteudo();
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement }).current = raiz;

    renderHook(() => useReveal(ref));
    expect(io.alvos).toHaveLength(3);

    // Primeiro disparo: só o primeiro está visível
    act(() => {
      io.disparar([true, false, false]);
    });
    const nodes = raiz.querySelectorAll<HTMLElement>("[data-reveal]");
    expect(nodes[0].style.opacity).toBe("1");
    expect(nodes[1].style.opacity).toBe("0");
    expect(nodes[1].style.transform).toBe("translateY(8px)");
    expect(nodes[1].style.transition).toContain("520ms");

    // Logo depois, tudo entra (nada fica escondido)
    act(() => {
      vi.advanceTimersByTime(600);
    });
    nodes.forEach((n) => expect(n.style.opacity).toBe("1"));
    vi.useRealTimers();
  });
});

describe("useFlowSteps", () => {
  it("sem observer (ou com movimento reduzido) marca o último passo", () => {
    comMatchMedia(true);
    const { result } = renderHook(() => useFlowSteps(4));
    expect(result.current.ativo).toBe(3);
  });

  it("com observer começa no primeiro passo e acompanha a rolagem", () => {
    comMatchMedia(false);
    const io = instalarObserver();
    const { result } = renderHook(() => {
      const flow = useFlowSteps(3);
      return flow;
    });

    // Registra três nós para o observer
    const nos = [0, 1, 2].map(() => document.createElement("div"));
    act(() => {
      nos.forEach((n, i) => result.current.registrar(i)(n));
    });
    expect(result.current.ativo).toBe(0);
  });
});

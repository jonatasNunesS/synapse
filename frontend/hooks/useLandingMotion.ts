"use client";
/**
 * Landing — animações de rolagem (porte do support.js do Design Canvas).
 *
 * useReveal: fade + translateY(8px) nos elementos [data-reveal] quando entram
 * na tela. Nada de biblioteca: IntersectionObserver puro.
 *
 * Detalhe importante herdado do original: os elementos NASCEM visíveis. Só
 * depois que o observer prova que funciona é que os que estão fora da tela
 * são escondidos para entrar animando. Assim, sem JS, sem IntersectionObserver
 * ou com prefers-reduced-motion, a página aparece inteira.
 *
 * useFlowSteps: destaca o passo do "como funciona" conforme a rolagem, e
 * devolve o índice ativo para o componente derivar os estilos.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

const REVEAL_TRANSITION =
  "opacity 520ms cubic-bezier(.2,.6,.2,1), transform 520ms cubic-bezier(.2,.6,.2,1)";

function prefereMenosMovimento(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useReveal(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const raiz = containerRef.current;
    if (!raiz) return;

    const nodes = Array.from(
      raiz.querySelectorAll<HTMLElement>("[data-reveal]")
    );
    // Sem movimento (ou sem suporte) → tudo fica como está: visível.
    if (
      !nodes.length ||
      prefereMenosMovimento() ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    const pendentes = new Set(nodes);
    const mostrar = (n: HTMLElement) => {
      n.style.opacity = "1";
      n.style.transform = "none";
      pendentes.delete(n);
    };
    const mostrarTodos = () => nodes.forEach(mostrar);

    let armado = false;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      (entries, obs) => {
        if (!armado) {
          armado = true;
          entries.forEach((e) => {
            if (e.isIntersecting) {
              mostrar(e.target as HTMLElement);
              obs.unobserve(e.target);
            }
          });
          // Só o que está fora da tela é escondido para entrar animando.
          pendentes.forEach((n) => {
            n.style.opacity = "0";
            n.style.transform = "translateY(8px)";
            n.style.transition = REVEAL_TRANSITION;
          });
          // Como no original: logo em seguida tudo entra. Quem está abaixo da
          // dobra já chega revelado quando o visitante rola até lá.
          timers.push(window.setTimeout(mostrarTodos, 600));
          return;
        }
        entries.forEach((e) => {
          if (e.isIntersecting) {
            mostrar(e.target as HTMLElement);
            obs.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );

    nodes.forEach((n) => io.observe(n));
    // Rede de segurança: se o observer não disparar, nada fica escondido.
    timers.push(
      window.setTimeout(() => {
        if (!armado) mostrarTodos();
      }, 600)
    );

    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [containerRef]);
}

export function useFlowSteps(total: number) {
  const [ativo, setAtivo] = useState(0);
  const nodes = useRef<(HTMLElement | null)[]>([]);

  const registrar = useCallback(
    (indice: number) => (node: HTMLElement | null) => {
      nodes.current[indice] = node;
    },
    []
  );

  useEffect(() => {
    // Sem movimento: mostra a trilha inteira percorrida.
    if (prefereMenosMovimento() || !("IntersectionObserver" in window)) {
      setAtivo(total - 1);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const k = nodes.current.indexOf(e.target as HTMLElement);
          if (k > -1) setAtivo(k);
        });
      },
      { rootMargin: "-38% 0px -46% 0px", threshold: 0 }
    );
    nodes.current.forEach((n) => n && io.observe(n));
    return () => io.disconnect();
  }, [total]);

  return { ativo, registrar };
}

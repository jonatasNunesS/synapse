"use client";
/**
 * "A tela é estreita?" — para escolher o que mostrar no celular.
 *
 * Usa `useSyncExternalStore` em vez de um `useEffect` com `setState`: é o jeito
 * do React de ler um valor que só existe no navegador sem provocar divergência
 * de hidratação e sem cascata de renders.
 */
import { useSyncExternalStore } from "react";

/** O mesmo corte do prefixo `md:` do Tailwind, para a tela e o CSS concordarem. */
const CONSULTA = "(max-width: 767px)";

function temMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function assinar(aoMudar: () => void): () => void {
  if (!temMatchMedia()) return () => {};
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener("change", aoMudar);
  return () => mq.removeEventListener("change", aoMudar);
}

function agora(): boolean {
  return temMatchMedia() && window.matchMedia(CONSULTA).matches;
}

/**
 * No servidor (e no primeiro render, antes da hidratação) responde `false`:
 * a tela larga é o palpite seguro — quem está no desktop nunca vê a tela
 * trocar de forma na frente dele.
 */
function noServidor(): boolean {
  return false;
}

export function useTelaEstreita(): boolean {
  return useSyncExternalStore(assinar, agora, noServidor);
}

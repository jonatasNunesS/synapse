"use client";
/**
 * O modo que está pintado na tela agora ("sistema" já resolvido).
 *
 * Serve para os poucos lugares que precisam da cor em JavaScript e não podem
 * usar o token direto — preview de paleta, cores do Recharts. A fonte é o
 * data-modo do <html>, o mesmo que o script inline e o useAuth escrevem.
 */
import { useEffect, useState } from "react";
import type { ModoEfetivo } from "@/lib/preferencias";

export function useModoEfetivo(): ModoEfetivo {
  const [modo, setModo] = useState<ModoEfetivo>("escuro");

  useEffect(() => {
    const ler = () =>
      setModo(
        document.documentElement.dataset.modo === "claro" ? "claro" : "escuro"
      );
    ler();

    const observador = new MutationObserver(ler);
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-modo"],
    });
    return () => observador.disconnect();
  }, []);

  return modo;
}

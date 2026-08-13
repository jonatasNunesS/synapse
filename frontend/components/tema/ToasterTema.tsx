"use client";
/**
 * O Toaster do sonner com o tema em dia.
 *
 * O sonner pinta os toasts por conta própria e não lê os tokens do Synapse,
 * então precisa ser avisado do modo. Era `theme="dark"` fixo — no modo claro
 * isso deixava caixas pretas sobre a tela branca.
 *
 * O modo efetivo (com "sistema" já resolvido) é lido do <html>, que é onde o
 * script inline e o useAuth escrevem — e reagimos à troca pelo mesmo
 * MutationObserver que os gráficos usam.
 */
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import type { ModoEfetivo } from "@/lib/preferencias";

export function ToasterTema() {
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

  return (
    <Toaster
      theme={modo === "claro" ? "light" : "dark"}
      richColors
      position="top-right"
    />
  );
}

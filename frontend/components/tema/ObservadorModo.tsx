"use client";
/**
 * Mantém o modo claro/escuro em dia enquanto a aba está aberta.
 *
 * Só faz sentido para quem escolheu "sistema": nesse caso a pessoa espera que
 * trocar o tema do aparelho (ou o anoitecer, no agendamento automático do SO)
 * mude o Synapse na hora, sem recarregar. Nas escolhas explícitas o listener
 * nem chega a ser registrado.
 *
 * Não renderiza nada — é só o efeito.
 */
import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  lerModoDoCookie,
  modoValido,
  observarModoDoSistema,
} from "@/lib/preferencias";

export function ObservadorModo() {
  const escolhaDoUsuario = useAppStore((s) => s.usuario?.tema_modo);

  useEffect(() => {
    // Antes do /auth/me responder (ou nas telas públicas) vale o cookie, que
    // é a mesma fonte que o script inline usou.
    const escolha = escolhaDoUsuario
      ? modoValido(escolhaDoUsuario)
      : lerModoDoCookie();

    return observarModoDoSistema(escolha, () => {});
  }, [escolhaDoUsuario]);

  return null;
}

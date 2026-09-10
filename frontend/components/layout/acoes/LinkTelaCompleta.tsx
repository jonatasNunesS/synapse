"use client";
/**
 * O escape do atalho: "isto aqui não basta, me leve para a tela do módulo".
 *
 * O formulário do atalho é o formulário completo — não há campo faltando. O
 * que a tela do módulo tem a mais é o resto: a lista, os filtros, o histórico.
 * Quem abriu o atalho e percebeu que precisa daquilo sai por aqui.
 *
 * Fica no alto, logo abaixo do header, e não no rodapé: o rodapé é onde os
 * formulários põem Salvar e Cancelar, e um link flutuando ali cobriria os dois
 * no celular.
 */
import { ArrowUpRight } from "lucide-react";

interface Props {
  /** Para onde ir. */
  href: string;
  /** O nome do módulo, como aparece no menu. */
  modulo: string;
  onIr: (href: string) => void;
  onFechar: () => void;
}

export function LinkTelaCompleta({ href, modulo, onIr, onFechar }: Props) {
  return (
    <div className="pointer-events-none fixed left-1/2 top-[72px] z-[60] -translate-x-1/2">
      <button
        type="button"
        onClick={() => {
          // Fecha o atalho antes de navegar: voltar e encontrar o modal ainda
          // aberto por cima da tela seria confuso.
          onFechar();
          onIr(href);
        }}
        className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow-elevacao backdrop-blur-sm transition-colors hover:text-foreground"
      >
        Abrir a tela de {modulo}
        <ArrowUpRight className="h-3 w-3" />
      </button>
    </div>
  );
}

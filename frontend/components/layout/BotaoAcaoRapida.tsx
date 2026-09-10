"use client";
/**
 * Synapse — o atalho de registrar sem sair da tela.
 *
 * Quem está conferindo o estoque e lembra de uma venda não deveria ter que
 * largar a tela, ir até Vendas, registrar e voltar tentando lembrar onde
 * estava. O botão traz o formulário até a pessoa.
 *
 * NÃO há formulário novo aqui. Cada ação monta o mesmo componente que a tela
 * do módulo monta, com a mesma função de criar — o que muda é de onde ela foi
 * chamada. Se um formulário ganhar um campo amanhã, ele aparece aqui sem
 * ninguém precisar lembrar deste arquivo.
 *
 * O menu mostra só o que a empresa usa, pela mesma regra da sidebar
 * (`moduloAtivo`). Vendas segue o módulo Estoque porque é assim que a sidebar
 * decide mostrar a aba Vendas — a regra é uma só, e há teste para as duas não
 * se separarem.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Package, Plus, Receipt, Users, X } from "lucide-react";

import { useAppStore } from "@/store/useAppStore";
import { useModulos } from "@/hooks/useModulos";
import type { ModuloOpcional } from "@/types/auth";
import { cn } from "@/lib/utils";

import { AcaoRapidaCliente } from "./acoes/AcaoRapidaCliente";
import { AcaoRapidaProduto } from "./acoes/AcaoRapidaProduto";
import { AcaoRapidaProjeto } from "./acoes/AcaoRapidaProjeto";
import { AcaoRapidaVenda } from "./acoes/AcaoRapidaVenda";

export type AcaoRapida = "venda" | "cliente" | "produto" | "projeto";

interface ItemAcao {
  acao: AcaoRapida;
  label: string;
  icon: typeof Plus;
  /** Sem módulo = sempre visível (Clientes é obrigatório no sistema). */
  modulo?: ModuloOpcional;
}

/**
 * O menu, na ordem em que se usa.
 *
 * `modulo` tem exatamente o mesmo significado que na sidebar: a entrada some
 * quando a empresa não usa aquele módulo.
 */
export const ACOES: ItemAcao[] = [
  { acao: "venda", label: "Registrar venda", icon: Receipt, modulo: "estoque" },
  { acao: "cliente", label: "Registrar cliente", icon: Users },
  { acao: "produto", label: "Registrar produto", icon: Package, modulo: "estoque" },
  { acao: "projeto", label: "Registrar projeto", icon: FolderKanban, modulo: "projetos" },
];

export function BotaoAcaoRapida() {
  const { moduloAtivo } = useModulos();
  const { sidebarOpen } = useAppStore();
  const router = useRouter();

  const [aberto, setAberto] = useState(false);
  const [acao, setAcao] = useState<AcaoRapida | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  // Mesma regra da sidebar, escrita do mesmo jeito.
  const visiveis = ACOES.filter((item) => !item.modulo || moduloAtivo(item.modulo));

  const fecharMenu = useCallback(() => {
    setAberto(false);
    // Devolve o foco a quem abriu: quem navega por teclado não fica perdido.
    botaoRef.current?.focus();
  }, []);

  // Esc fecha, e um clique fora também.
  useEffect(() => {
    if (!aberto) return;

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") fecharMenu();
    };
    const aoClicar = (evento: MouseEvent) => {
      if (!containerRef.current?.contains(evento.target as Node)) setAberto(false);
    };

    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("mousedown", aoClicar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("mousedown", aoClicar);
    };
  }, [aberto, fecharMenu]);

  const escolher = (escolhida: AcaoRapida) => {
    setAberto(false);
    setAcao(escolhida);
  };

  /** Fecha o formulário sem tirar a pessoa de onde ela estava. */
  const fecharFormulario = useCallback(() => setAcao(null), []);

  // Nenhuma ação disponível: a empresa desligou tudo que o botão oferece
  // menos Clientes — mas Clientes é obrigatório, então isto é defensivo.
  if (visiveis.length === 0) return null;

  return (
    <>
      <div
        ref={containerRef}
        className={cn(
          // z-20: acima do conteúdo, abaixo do header (30), da sidebar (40) e
          // dos modais que ele mesmo abre (50).
          "fixed bottom-5 right-5 z-20 flex flex-col items-end gap-2 md:bottom-6 md:right-6",
          // No mobile a sidebar é uma gaveta com fundo escuro por cima da
          // tela; o botão sairia flutuando sobre ela. Some enquanto ela está
          // aberta — no desktop `sidebarOpen` só quer dizer "expandida".
          sidebarOpen && "hidden md:flex"
        )}
      >
        {aberto && (
          <div
            id="menu-acao-rapida"
            role="menu"
            aria-label="Ações rápidas"
            data-testid="menu-acao-rapida"
            className="flex flex-col items-end gap-2"
          >
            {visiveis.map((item, indice) => {
              const Icone = item.icon;
              return (
                <button
                  key={item.acao}
                  role="menuitem"
                  type="button"
                  onClick={() => escolher(item.acao)}
                  // A animação escalonada é enfeite: quem pediu menos
                  // movimento recebe o menu inteiro de uma vez.
                  style={{ animationDelay: `${indice * 40}ms` }}
                  className="motion-safe:animate-surgir-de-baixo inline-flex items-center gap-2 rounded-full border border-border bg-card py-2 pl-4 pr-3 text-sm font-medium text-foreground shadow-elevacao-lg transition-colors hover:bg-superficie motion-reduce:animate-none"
                >
                  {item.label}
                  <Icone className="h-4 w-4 text-brand-accent" />
                </button>
              );
            })}
          </div>
        )}

        <button
          ref={botaoRef}
          type="button"
          onClick={() => (aberto ? fecharMenu() : setAberto(true))}
          aria-label={aberto ? "Fechar ações rápidas" : "Ações rápidas"}
          aria-expanded={aberto}
          aria-haspopup="menu"
          aria-controls={aberto ? "menu-acao-rapida" : undefined}
          data-testid="botao-acao-rapida"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-elevacao-lg transition-colors hover:bg-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {aberto ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>

      {/*
        Cada formulário é o do módulo, montado como ele já é montado lá. O hook
        de cada um só roda quando a ação está aberta — por isso cada ação tem o
        seu próprio componente, e não um `if` dentro deste.
      */}
      {acao === "venda" && (
        <AcaoRapidaVenda onFechar={fecharFormulario} onIrParaTela={router.push} />
      )}
      {acao === "cliente" && (
        <AcaoRapidaCliente onFechar={fecharFormulario} onIrParaTela={router.push} />
      )}
      {acao === "produto" && (
        <AcaoRapidaProduto onFechar={fecharFormulario} onIrParaTela={router.push} />
      )}
      {acao === "projeto" && (
        <AcaoRapidaProjeto onFechar={fecharFormulario} onIrParaTela={router.push} />
      )}
    </>
  );
}

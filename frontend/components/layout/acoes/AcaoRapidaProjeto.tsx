"use client";
/**
 * Registrar projeto pelo atalho — com o formulário da tela de Projetos.
 *
 * O `ProjetoForm` controla a própria abertura por prop (`aberto`), então aqui
 * ele nasce aberto: o atalho já é a decisão de abri-lo.
 */
import { toast } from "sonner";

import { ProjetoForm } from "@/components/projetos/ProjetoForm";
import { useProjetos } from "@/hooks/useProjetos";
import type { ProjetoCreatePayload } from "@/types/projetos";

import { LinkTelaCompleta } from "./LinkTelaCompleta";

interface Props {
  onFechar: () => void;
  onIrParaTela: (href: string) => void;
}

export function AcaoRapidaProjeto({ onFechar, onIrParaTela }: Props) {
  const { criar } = useProjetos();

  const registrar = async (dados: ProjetoCreatePayload) => {
    // O erro sobe: o próprio formulário mostra o motivo e fica aberto.
    await criar(dados);
    toast.success("Projeto criado.", {
      action: { label: "Ver", onClick: () => onIrParaTela("/projetos") },
    });
    onFechar();
  };

  return (
    <>
      <ProjetoForm aberto projeto={null} onFechar={onFechar} onSalvar={registrar} />
      <LinkTelaCompleta
        href="/projetos"
        modulo="Projetos"
        onIr={onIrParaTela}
        onFechar={onFechar}
      />
    </>
  );
}

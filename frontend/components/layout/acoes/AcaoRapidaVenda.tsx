"use client";
/**
 * Registrar venda pelo atalho — com o formulário da tela de Vendas.
 *
 * O `VendaForm` aqui é o mesmo componente e a mesma função `criar` do hook. As
 * perguntas de estoque e financeiro que seguem a venda também são as mesmas:
 * quem registra pelo atalho responde exatamente o que responderia lá.
 */
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { VendaForm } from "@/components/vendas/VendaForm";
import { VendaPosVendaFlow } from "@/components/vendas/VendaPosVendaFlow";
import { useVendas } from "@/hooks/useVendas";
import type { Venda, VendaPayload } from "@/types/vendas";

import { LinkTelaCompleta } from "./LinkTelaCompleta";

interface Props {
  onFechar: () => void;
  onIrParaTela: (href: string) => void;
}

export function AcaoRapidaVenda({ onFechar, onIrParaTela }: Props) {
  const { criar } = useVendas();
  const [recemCriada, setRecemCriada] = useState<Venda | null>(null);

  const registrar = async (dados: VendaPayload): Promise<Venda> => {
    const nova = await criar(dados);
    // O toast leva para a venda, mas não arrasta ninguém: quem usou o atalho
    // fez isso justamente para não sair da tela.
    toast.success("Venda registrada.", {
      action: { label: "Ver", onClick: () => onIrParaTela("/vendas") },
    });
    setRecemCriada(nova);
    return nova;
  };

  const fecharPerguntas = useCallback(() => {
    setRecemCriada(null);
    onFechar();
  }, [onFechar]);

  // Enquanto as perguntas do pós-venda rodam, o formulário já saiu de cena.
  if (recemCriada) {
    return (
      <VendaPosVendaFlow
        venda={recemCriada}
        onFim={fecharPerguntas}
      />
    );
  }

  return (
    <>
      <VendaForm onSubmit={registrar} onClose={onFechar} />
      <LinkTelaCompleta
        href="/vendas"
        modulo="Vendas"
        onIr={onIrParaTela}
        onFechar={onFechar}
      />
    </>
  );
}

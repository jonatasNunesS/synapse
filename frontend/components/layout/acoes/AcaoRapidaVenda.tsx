"use client";
/**
 * Registrar venda pelo atalho — com o formulário da tela de Vendas.
 *
 * O `VendaForm` aqui é o mesmo componente e a mesma função `criar` do hook. As
 * perguntas de estoque e financeiro que seguem a venda também são as mesmas:
 * quem registra pelo atalho responde exatamente o que responderia lá.
 *
 * POR QUE O FECHAMENTO É CONDICIONAL. O `VendaForm` chama `onClose()` depois
 * de salvar, e `onFechar` aqui desmonta este componente inteiro — é o
 * `setAcao(null)` do botão flutuante. Passar um direto no outro fazia a venda
 * ser gravada e o atalho sumir no mesmo render, levando as perguntas do
 * pós-venda junto: a pessoa registrava a venda e nunca era perguntada sobre
 * estoque e financeiro. Depois de gravar, quem fecha é o fim do pós-venda.
 */
import { useCallback, useRef, useState } from "react";
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
  // Ref e não state: quem lê isto é o `onClose` que o formulário chama no
  // mesmo tick em que a venda foi criada, antes de qualquer novo render.
  const gravou = useRef(false);

  const registrar = async (dados: VendaPayload): Promise<Venda> => {
    const nova = await criar(dados);
    gravou.current = true;
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

  /**
   * O X do formulário fecha o atalho; o fechamento pós-gravação, não.
   *
   * `VendaForm.onClose` serve aos dois casos, e só o primeiro deve derrubar
   * o atalho — no segundo as perguntas de estoque e financeiro ainda têm de
   * acontecer.
   */
  const fecharFormulario = useCallback(() => {
    if (gravou.current) return;
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
      <VendaForm onSubmit={registrar} onClose={fecharFormulario} />
      <LinkTelaCompleta
        href="/vendas"
        modulo="Vendas"
        onIr={onIrParaTela}
        onFechar={onFechar}
      />
    </>
  );
}

"use client";
/**
 * Synapse — as perguntas ao apagar uma venda que já mexeu em estoque ou caixa.
 *
 * A simetria do ciclo de vida: se registrar a venda perguntou antes de baixar
 * e antes de lançar, apagá-la precisa perguntar antes de desfazer. Sem isso a
 * venda some e o estoque fica curto, ou a receita fica no caixa sem nada por
 * trás — e ninguém descobre até conferir.
 *
 * Mesma sequência do fluxo antigo de interação (`ApagarComAjustesFlow`):
 * 1) baixou estoque → "devolver os produtos?"
 * 2) tem lançamento → "apagar a receita?"
 * Depois executa com as duas escolhas. Quem desfaz é o backend, numa transação
 * só: o estorno é movimentação inversa, nunca apagar a movimentação original —
 * o estoque é imutável por design, e o histórico de que a saída aconteceu fica.
 */
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatCurrency } from "@/lib/utils";
import type { Venda } from "@/types/vendas";

interface Props {
  venda: Venda;
  /** Estoque desligado → não se pergunta sobre estoque, só sobre o caixa. */
  estoqueAtivo: boolean;
  processando?: boolean;
  /**
   * Recebe as duas escolhas. "Não" às duas é uma resposta completa — apaga só
   * a venda —, e por isso o fluxo não tem saída de cancelamento: quem cancela
   * a exclusão inteira faz isso na confirmação que vem antes destas perguntas.
   */
  onFinalizar: (estornarEstoque: boolean, apagarFinanceiro: boolean) => void;
}

export function VendaApagarFlow({
  venda,
  estoqueAtivo,
  processando,
  onFinalizar,
}: Props) {
  const temEstoque = estoqueAtivo && venda.ja_baixou_estoque;
  const temFinanceiro = venda.tem_lancamento_financeiro;

  const [etapa, setEtapa] = useState<"estoque" | "financeiro">(
    temEstoque ? "estoque" : "financeiro"
  );
  const [estornarEstoque, setEstornarEstoque] = useState(false);

  const decidirEstoque = (estornar: boolean) => {
    setEstornarEstoque(estornar);
    if (temFinanceiro) setEtapa("financeiro");
    else onFinalizar(estornar, false);
  };

  if (etapa === "estoque") {
    // Só os itens com produto foram ao estoque; item livre não baixou nada e
    // listá-lo aqui prometeria uma devolução que não vai acontecer.
    const itens = venda.itens.filter((item) => item.produto);
    return (
      <ConfirmDialog
        open
        danger={false}
        processando={processando}
        titulo="Devolver ao estoque?"
        mensagem={
          <>
            Esta venda descontou do estoque. Quer devolver
            {itens.length === 1 ? " " : ":"}
            <span className="font-medium text-foreground">
              {itens.length === 1
                ? `${itens[0].quantidade} ${itens[0].produto_unidade} de ${itens[0].produto_nome}`
                : ` ${itens.length} produtos`}
            </span>
            ?
          </>
        }
        confirmLabel="Sim, devolver ao estoque"
        cancelLabel="Não, manter"
        onConfirm={() => decidirEstoque(true)}
        onCancel={() => decidirEstoque(false)}
      />
    );
  }

  return (
    <ConfirmDialog
      open
      danger={false}
      processando={processando}
      titulo="Apagar lançamento financeiro?"
      mensagem={
        <>
          Esta venda tem lançamento financeiro. Quer apagar a receita de{" "}
          <span className="font-medium text-foreground">{formatCurrency(venda.total)}</span>{" "}
          também?
        </>
      }
      confirmLabel="Sim, apagar lançamento"
      cancelLabel="Não, manter"
      onConfirm={() => onFinalizar(estornarEstoque, true)}
      onCancel={() => onFinalizar(estornarEstoque, false)}
    />
  );
}

/** Esta venda tem algum vínculo a desfazer? Sem isso, apaga direto. */
export function vendaTemVinculos(venda: Venda, estoqueAtivo: boolean): boolean {
  return (estoqueAtivo && venda.ja_baixou_estoque) || venda.tem_lancamento_financeiro;
}

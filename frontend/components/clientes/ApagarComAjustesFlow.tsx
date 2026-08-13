"use client";
/**
 * Sequência de perguntas ao apagar uma venda/compra com vínculos:
 * 1) se tem movimentação de estoque → "estornar a saída?" (sim/não)
 * 2) se tem lançamento financeiro → "apagar a receita?" (sim/não)
 * Depois chama onFinalizar com as duas escolhas. Se não há vínculo, executa
 * direto. Reaproveita o ConfirmDialog (dois botões) para cada pergunta.
 */
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { MovimentacaoInfo, LancamentoInfo } from "@/types/clientes";

interface Props {
  /** "receita" (venda) ou "despesa" (compra) — muda o texto do financeiro. */
  tipoFinanceiro: "receita" | "despesa";
  movimentacaoInfo?: MovimentacaoInfo | null;
  lancamentoInfo?: LancamentoInfo | null;
  processando?: boolean;
  onFinalizar: (estornarEstoque: boolean, apagarFinanceiro: boolean) => void;
}

function moeda(v: string): string {
  const n = parseFloat(v);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    isNaN(n) ? 0 : n
  );
}

export function ApagarComAjustesFlow({
  tipoFinanceiro,
  movimentacaoInfo,
  lancamentoInfo,
  processando,
  onFinalizar,
}: Props) {
  const temEstoque = !!movimentacaoInfo;
  const temFinanceiro = !!lancamentoInfo;
  // Venda (receita) desconta/saída do estoque; compra (despesa) adiciona/entrada.
  const ehVenda = tipoFinanceiro === "receita";
  const origem = ehVenda ? "Esta venda" : "Esta compra";

  const [etapa, setEtapa] = useState<"estoque" | "financeiro" | "exec">(
    temEstoque ? "estoque" : temFinanceiro ? "financeiro" : "exec"
  );
  const [estornarEstoque, setEstornarEstoque] = useState(false);

  // Sem nenhum vínculo → finaliza direto (apaga sem perguntas).
  useEffect(() => {
    if (etapa === "exec") onFinalizar(estornarEstoque, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa]);

  const decidirEstoque = (estornar: boolean) => {
    setEstornarEstoque(estornar);
    if (temFinanceiro) setEtapa("financeiro");
    else onFinalizar(estornar, false);
  };

  const decidirFinanceiro = (apagar: boolean) => {
    onFinalizar(estornarEstoque, apagar);
  };

  if (etapa === "estoque" && movimentacaoInfo) {
    return (
      <ConfirmDialog
        open
        danger={false}
        titulo="Estornar do estoque?"
        mensagem={
          <>
            {origem} {ehVenda ? "descontou do" : "adicionou ao"} estoque. Quer estornar
            a {ehVenda ? "saída" : "entrada"} de{" "}
            <span className="text-foreground font-medium">
              {movimentacaoInfo.quantidade} un. de {movimentacaoInfo.produto_nome}
            </span>
            ?
          </>
        }
        confirmLabel="Sim, estornar estoque"
        cancelLabel="Não, manter"
        onConfirm={() => decidirEstoque(true)}
        onCancel={() => decidirEstoque(false)}
      />
    );
  }

  if (etapa === "financeiro" && lancamentoInfo) {
    const label = tipoFinanceiro === "receita" ? "a receita" : "a despesa";
    return (
      <ConfirmDialog
        open
        danger={false}
        processando={processando}
        titulo="Apagar lançamento financeiro?"
        mensagem={
          <>
            {origem} tem lançamento financeiro. Quer apagar {label} de{" "}
            <span className="text-foreground font-medium">{moeda(lancamentoInfo.valor)}</span>{" "}
            também?
          </>
        }
        confirmLabel="Sim, apagar lançamento"
        cancelLabel="Não, manter"
        onConfirm={() => decidirFinanceiro(true)}
        onCancel={() => decidirFinanceiro(false)}
      />
    );
  }

  return null;
}

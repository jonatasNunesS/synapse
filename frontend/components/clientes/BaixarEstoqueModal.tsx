"use client";
/**
 * Após registrar uma interação de VENDA, oferece baixar do estoque.
 * Passo 1: "Deseja baixar do estoque?" → Passo 2: escolher produto + quantidade,
 * com preview "Estoque atual: X → vai ficar: Y" → confirma a saída.
 *
 * Soft block (mesmo padrão das caixinhas): se o backend responder
 * ESTOQUE_INSUFICIENTE, mostramos o saldo real e oferecemos baixar tudo que há.
 */
import { useState } from "react";
import { X, PackageMinus, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useInteracoes } from "@/hooks/useClientes";
import { getErrorMessage } from "@/lib/api";
import { ProdutoSelect } from "@/components/estoque/ProdutoSelect";
import type { InteracaoCliente } from "@/types/clientes";
import type { ProdutoList } from "@/types/estoque";
import type { ApiError } from "@/types/api";

interface BaixarEstoqueModalProps {
  clienteId: string;
  clienteNome: string;
  interacao: InteracaoCliente;
  onClose: () => void;
  onSuccess?: () => void;
}

function formatCurrency(value: string | null): string | null {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

export function BaixarEstoqueModal({
  clienteId,
  clienteNome,
  interacao,
  onClose,
  onSuccess,
}: BaixarEstoqueModalProps) {
  const { baixarEstoque } = useInteracoes(clienteId);
  const [etapa, setEtapa] = useState<"pergunta" | "selecao">("pergunta");
  const [produto, setProduto] = useState<ProdutoList | null>(null);
  const [quantidade, setQuantidade] = useState("1");
  const [processando, setProcessando] = useState(false);
  // Soft block: quando o estoque é insuficiente, guardamos o saldo real
  const [saldoInsuficiente, setSaldoInsuficiente] = useState<number | null>(null);

  const qtd = Number(quantidade);
  const estoqueAtual = produto ? Number(produto.estoque_atual) : 0;
  const estoqueDepois = produto ? estoqueAtual - qtd : 0;

  const executarBaixa = async (quantidadeFinal: number) => {
    if (!produto || !(quantidadeFinal > 0) || processando) return;
    setProcessando(true);
    try {
      await baixarEstoque(interacao.id, produto.id, quantidadeFinal);
      toast.success(
        `Saída de ${quantidadeFinal} ${produto.unidade} registrada no estoque.`
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr?.error?.code === "ESTOQUE_INSUFICIENTE") {
        // Soft block: oferece baixar o que há
        const saldo = Number(apiErr.error.details?.saldo_atual ?? 0);
        setSaldoInsuficiente(saldo);
      } else {
        // Erro NUNCA calado: mostra a mensagem real do backend
        toast.error(getErrorMessage(err), { duration: 7000 });
      }
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <PackageMinus className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-semibold text-white">Baixar do estoque</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {/* Soft block tem prioridade quando ativo */}
          {saldoInsuficiente !== null ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <p className="text-sm text-amber-200">
                Estoque atual é <span className="font-semibold">{saldoInsuficiente}</span>.
                Quer registrar saída de {saldoInsuficiente} (tudo que tem)?
              </p>
            </div>
          ) : etapa === "pergunta" ? (
            <>
              <p className="text-sm text-slate-300">Deseja baixar do estoque?</p>
              <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-sm text-white">
                  Venda para:{" "}
                  <span className="font-medium">{clienteNome}</span>
                </p>
                {formatCurrency(interacao.valor) && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    Valor: {formatCurrency(interacao.valor)}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Produto no estoque
                </label>
                <ProdutoSelect value={produto} onChange={setProduto} />
              </div>
              {produto && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                      aria-label="Quantidade"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50"
                    />
                  </div>
                  {qtd > 0 && (
                    <p className="text-xs text-slate-400">
                      Estoque atual: {estoqueAtual} → vai ficar:{" "}
                      <span
                        className={
                          estoqueDepois < 0 ? "text-amber-400" : "text-white"
                        }
                      >
                        {estoqueDepois}
                      </span>
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3.5">
          {saldoInsuficiente !== null ? (
            <>
              <button
                onClick={onClose}
                disabled={processando}
                className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => executarBaixa(saldoInsuficiente)}
                disabled={processando || !(saldoInsuficiente > 0)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {processando && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar {saldoInsuficiente}
              </button>
            </>
          ) : etapa === "pergunta" ? (
            <>
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
              >
                Não agora
              </button>
              <button
                onClick={() => setEtapa("selecao")}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
              >
                Sim, baixar estoque
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={processando}
                className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => executarBaixa(qtd)}
                disabled={!produto || !(qtd > 0) || processando}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processando && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar saída
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";
/**
 * Após registrar uma compra, oferece dar entrada no estoque.
 * Passo 1: "Deseja adicionar ao estoque?" → Passo 2: escolher produto existente
 * + quantidade → confirma a entrada. Se a compra já foi adicionada antes,
 * mostra o aviso e não oferece de novo (não duplica).
 */
import { useState } from "react";
import { X, PackagePlus, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useComprasFornecedor } from "@/hooks/useFornecedores";
import { getErrorMessage } from "@/lib/api";
import { ProdutoSelect } from "@/components/estoque/ProdutoSelect";
import { NovoProdutoInline } from "@/components/estoque/NovoProdutoInline";
import type { CompraFornecedor } from "@/types/fornecedores";
import type { ProdutoList } from "@/types/estoque";

interface AdicionarEstoqueModalProps {
  compra: CompraFornecedor;
  fornecedorNome?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AdicionarEstoqueModal({
  compra,
  fornecedorNome,
  onClose,
  onSuccess,
}: AdicionarEstoqueModalProps) {
  const { adicionarAoEstoque } = useComprasFornecedor();
  const [etapa, setEtapa] = useState<"pergunta" | "selecao">("pergunta");
  const [produto, setProduto] = useState<ProdutoList | null>(null);
  const [criandoProduto, setCriandoProduto] = useState(false);
  const [quantidade, setQuantidade] = useState("1");
  const [processando, setProcessando] = useState(false);

  const jaNoEstoque = !!compra.ja_no_estoque;

  const handleConfirmar = async () => {
    const qtd = Number(quantidade);
    if (!produto || !(qtd > 0) || processando) return;
    setProcessando(true);
    try {
      await adicionarAoEstoque(compra.id, produto.id, qtd);
      toast.success(`Entrada de ${qtd} ${produto.unidade} registrada no estoque.`);
      onSuccess?.();
      onClose();
    } catch (err) {
      // Erro NUNCA calado: mostra a mensagem real do backend
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-brand-accent" />
            <h3 className="text-base font-semibold text-foreground">
              Adicionar ao estoque
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-superficie-forte hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {jaNoEstoque ? (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sucesso" />
              <p className="text-sm text-sucesso">
                Esta compra já foi adicionada ao estoque.
              </p>
            </div>
          ) : etapa === "pergunta" ? (
            <>
              <p className="text-sm text-foreground-suave">Deseja adicionar ao estoque?</p>
              <div className="mt-3 rounded-lg border border-border bg-white/[0.03] px-4 py-3">
                <p className="text-sm font-medium text-foreground">{compra.descricao}</p>
                {fornecedorNome && (
                  <p className="mt-0.5 text-xs text-muted-suave">
                    Fornecedor: {fornecedorNome}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {criandoProduto ? (
                <NovoProdutoInline
                  nomeInicial={compra.descricao}
                  onCriado={(novo) => {
                    // Produto criado → já vem selecionado, com a qtd preservada.
                    setProduto(novo);
                    setCriandoProduto(false);
                  }}
                  onCancelar={() => setCriandoProduto(false)}
                />
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Qual produto recebeu?
                    </label>
                    <ProdutoSelect value={produto} onChange={setProduto} />
                  </div>

                  {!produto && (
                    <div>
                      <div className="flex items-center gap-3 py-1">
                        <span className="h-px flex-1 bg-superficie-forte" />
                        <span className="text-xs text-muted-suave">ou</span>
                        <span className="h-px flex-1 bg-superficie-forte" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setCriandoProduto(true)}
                        className="w-full rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-foreground-suave hover:border-brand-500/50 hover:bg-brand-500/5 hover:text-foreground transition-colors"
                      >
                        + Criar novo produto com base nessa compra
                      </button>
                    </div>
                  )}

                  {produto && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Quantidade
                      </label>
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        value={quantidade}
                        onChange={(e) => setQuantidade(e.target.value)}
                        aria-label="Quantidade"
                        className="w-full rounded-lg border border-border bg-superficie px-3 py-2 text-sm text-foreground outline-none focus:border-brand-500/50"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          {jaNoEstoque ? (
            <button
              onClick={onClose}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
            >
              Fechar
            </button>
          ) : etapa === "pergunta" ? (
            <>
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-foreground-suave hover:bg-superficie"
              >
                Não agora
              </button>
              <button
                onClick={() => setEtapa("selecao")}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
              >
                Sim, adicionar ao estoque
              </button>
            </>
          ) : criandoProduto ? (
            // O form inline de novo produto tem os próprios botões.
            <button
              onClick={onClose}
              disabled={processando}
              className="rounded-lg px-4 py-2 text-sm text-foreground-suave hover:bg-superficie disabled:opacity-50"
            >
              Cancelar
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={processando}
                className="rounded-lg px-4 py-2 text-sm text-foreground-suave hover:bg-superficie disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={!produto || !(Number(quantidade) > 0) || processando}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processando && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar entrada
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

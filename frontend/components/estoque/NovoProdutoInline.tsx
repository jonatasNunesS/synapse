"use client";
/**
 * Form inline de criação rápida de produto — usado dentro do modal de compra
 * para não quebrar o fluxo ("Criar novo produto com base nessa compra").
 * Pré-preenche o nome; ao salvar, devolve o produto criado para o modal.
 */
import { useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useProdutos } from "@/hooks/useEstoque";
import { getErrorMessage } from "@/lib/api";
import type { ProdutoList, UnidadeEstoque } from "@/types/estoque";

const UNIDADES: UnidadeEstoque[] = [
  "unidade", "kg", "g", "litro", "ml", "metro", "cm", "caixa", "pacote", "par",
];

interface NovoProdutoInlineProps {
  nomeInicial: string;
  onCriado: (produto: ProdutoList) => void;
  onCancelar: () => void;
}

export function NovoProdutoInline({ nomeInicial, onCriado, onCancelar }: NovoProdutoInlineProps) {
  const { criar } = useProdutos();
  const [nome, setNome] = useState(nomeInicial);
  const [unidade, setUnidade] = useState<UnidadeEstoque>("unidade");
  const [precoCusto, setPrecoCusto] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [salvando, setSalvando] = useState(false);

  const input =
    "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50";
  const label = "mb-1 block text-xs font-medium text-slate-400";

  const salvar = async () => {
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    try {
      const produto = await criar({
        nome: nome.trim(),
        unidade,
        preco_custo: precoCusto ? Number(precoCusto) : undefined,
        preco_venda: precoVenda ? Number(precoVenda) : undefined,
      });
      toast.success("Produto criado.");
      onCriado(produto as unknown as ProdutoList);
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
      setSalvando(false);
    }
  };

  return (
    <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-4 space-y-3">
      <p className="text-sm font-medium text-white">Novo produto</p>
      <div>
        <label className={label}>Nome *</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-label="Nome do produto"
          className={input}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={label}>Unidade</label>
          <select
            value={unidade}
            onChange={(e) => setUnidade(e.target.value as UnidadeEstoque)}
            aria-label="Unidade"
            className={input}
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u} className="bg-slate-900">{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Custo</label>
          <input
            type="number" step="0.01" min="0" placeholder="0,00"
            value={precoCusto} onChange={(e) => setPrecoCusto(e.target.value)}
            aria-label="Preço de custo" className={input}
          />
        </div>
        <div>
          <label className={label}>Venda</label>
          <input
            type="number" step="0.01" min="0" placeholder="0,00"
            value={precoVenda} onChange={(e) => setPrecoVenda(e.target.value)}
            aria-label="Preço de venda" className={input}
          />
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onCancelar}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={!nome.trim() || salvando}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar produto
        </button>
      </div>
    </div>
  );
}

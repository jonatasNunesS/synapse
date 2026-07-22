"use client";
/**
 * Seletor de produto com busca. Reutilizado pelos fluxos de compra→estoque e
 * venda→estoque. Filtra por texto (debounce) usando o endpoint de produtos.
 */
import { useEffect, useState } from "react";
import { Search, Loader2, Check } from "lucide-react";
import { useProdutos } from "@/hooks/useEstoque";
import type { ProdutoList } from "@/types/estoque";

interface ProdutoSelectProps {
  value: ProdutoList | null;
  onChange: (produto: ProdutoList | null) => void;
  disabled?: boolean;
}

export function ProdutoSelect({ value, onChange, disabled }: ProdutoSelectProps) {
  const { produtos, loading, listar } = useProdutos();
  const [busca, setBusca] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      listar({ busca: busca || undefined, page: 1 });
    }, 250);
    return () => clearTimeout(t);
  }, [busca, listar]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{value.nome}</p>
          <p className="text-xs text-slate-400">
            Estoque atual: {value.estoque_atual} {value.unidade}
          </p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-3 shrink-0 text-xs text-violet-300 hover:text-violet-200"
          >
            Trocar
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produto por nome ou SKU..."
          aria-label="Buscar produto"
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500/50"
        />
      </div>

      <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02]">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Buscando...
          </div>
        ) : produtos.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">
            Nenhum produto encontrado.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {produtos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onChange(p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-white/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white">{p.nome}</span>
                    <span className="text-xs text-slate-500">
                      {p.estoque_atual} {p.unidade} em estoque
                    </span>
                  </span>
                  <Check className="ml-2 h-4 w-4 shrink-0 text-transparent" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

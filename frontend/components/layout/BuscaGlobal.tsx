"use client";
/**
 * Synapse — Busca Global
 * Dropdown com resultados de Clientes, Produtos, Fornecedores, Projetos e Lançamentos.
 * Debounce 300ms. Mínimo 2 caracteres. Cache gerenciado pelo backend (TTL 30s).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Users,
  Package,
  Truck,
  FolderKanban,
  DollarSign,
  Loader2,
  X,
} from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";

interface ResultadoItem {
  id: string;
  nome?: string;
  descricao?: string;
  sku?: string;
  valor?: string;
  tipo?: string;
}

interface ResultadosBusca {
  clientes: ResultadoItem[];
  produtos: ResultadoItem[];
  fornecedores: ResultadoItem[];
  projetos: ResultadoItem[];
  lancamentos: (ResultadoItem & { descricao: string; valor: string })[];
}

const ROTAS: Record<keyof ResultadosBusca, string> = {
  clientes: "/clientes",
  produtos: "/estoque",
  fornecedores: "/fornecedores",
  projetos: "/projetos",
  lancamentos: "/financeiro",
};

const ICONES: Record<keyof ResultadosBusca, React.ReactNode> = {
  clientes: <Users className="h-3.5 w-3.5" />,
  produtos: <Package className="h-3.5 w-3.5" />,
  fornecedores: <Truck className="h-3.5 w-3.5" />,
  projetos: <FolderKanban className="h-3.5 w-3.5" />,
  lancamentos: <DollarSign className="h-3.5 w-3.5" />,
};

const LABELS: Record<keyof ResultadosBusca, string> = {
  clientes: "Clientes",
  produtos: "Produtos",
  fornecedores: "Fornecedores",
  projetos: "Projetos",
  lancamentos: "Lançamentos",
};

export function BuscaGlobal() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ResultadosBusca | null>(null);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const buscar = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResultados(null);
      setAberto(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<ResultadosBusca>(`/search/?q=${encodeURIComponent(q)}`);
      setResultados(res.data);
      setAberto(true);
    } catch {
      setResultados(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscar(query), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, buscar]);

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const temResultados =
    resultados &&
    Object.values(resultados).some((arr) => arr.length > 0);

  const irPara = (rota: string) => {
    setAberto(false);
    setQuery("");
    router.push(rota);
  };

  const limpar = () => {
    setQuery("");
    setResultados(null);
    setAberto(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xl">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600 pointer-events-none" />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600 animate-spin" />
        ) : query.length > 0 ? (
          <button
            onClick={limpar}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
            aria-label="Limpar busca"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => resultados && setAberto(true)}
          placeholder="Buscar clientes, produtos, projetos..."
          className="h-9 w-full rounded-lg border border-slate-800 bg-slate-900/60 pl-9 pr-8 text-sm text-slate-300 placeholder:text-slate-600
            focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/40 transition-colors"
        />
      </div>

      {/* Dropdown */}
      {aberto && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 rounded-xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/50 overflow-hidden">
          {!temResultados ? (
            <p className="px-4 py-3 text-sm text-slate-500 text-center">
              Nenhum resultado para &ldquo;{query}&rdquo;
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1.5">
              {(Object.keys(LABELS) as (keyof ResultadosBusca)[]).map((cat) => {
                const itens = resultados?.[cat] ?? [];
                if (itens.length === 0) return null;
                return (
                  <div key={cat} className="mb-1">
                    {/* Cabeçalho da categoria */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5">
                      <span className="text-slate-600">{ICONES[cat]}</span>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        {LABELS[cat]}
                      </span>
                    </div>
                    {/* Itens */}
                    {itens.map((item) => {
                      const label =
                        item.nome ??
                        item.descricao ??
                        "—";
                      const sub =
                        cat === "produtos" && item.sku
                          ? `SKU: ${item.sku}`
                          : cat === "lancamentos" && item.valor
                          ? `R$ ${Number(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : undefined;
                      return (
                        <button
                          key={item.id}
                          onClick={() => irPara(`${ROTAS[cat]}?id=${item.id}`)}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-slate-800 transition-colors group"
                        >
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-slate-300 truncate group-hover:text-slate-100">
                              {label}
                            </span>
                            {sub && (
                              <span className="block text-xs text-slate-600 truncate">
                                {sub}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

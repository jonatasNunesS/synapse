"use client";

import Link from "next/link";
import { AlertTriangle, Package, ArrowRight } from "lucide-react";
import type { ProdutoList } from "@/types/estoque";

interface AlertasEstoqueProps {
  alertas: ProdutoList[];
  loading?: boolean;
}

function StatusBadge({ status }: { status: "baixo" | "zerado" }) {
  if (status === "zerado") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20">
        Zerado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
      Baixo
    </span>
  );
}

export function AlertasEstoque({ alertas, loading }: AlertasEstoqueProps) {
  if (loading) {
    return (
      <div className="bg-[#0d1117] border border-white/10 rounded-xl p-5">
        <div className="h-5 w-40 bg-white/10 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (alertas.length === 0) {
    return (
      <div className="bg-[#0d1117] border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h3 className="font-semibold text-white">Alertas de Estoque</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Package className="h-10 w-10 text-slate-600 mb-2" />
          <p className="text-sm text-slate-400">Nenhum alerta no momento.</p>
          <p className="text-xs text-slate-500 mt-1">
            Todos os produtos estão com estoque adequado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1117] border border-amber-500/20 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h3 className="font-semibold text-white">Alertas de Estoque</h3>
          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
            {alertas.length}
          </span>
        </div>
        <Link
          href="/estoque?status_estoque=baixo"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Ver todos
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {alertas.slice(0, 8).map((produto) => (
          <Link
            key={produto.id}
            href={`/estoque/produtos/${produto.id}`}
            className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: produto.categoria_cor || "#6b7280",
                }}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                  {produto.nome}
                </p>
                <p className="text-xs text-slate-500">
                  {produto.sku || "Sem SKU"} · {produto.categoria_nome || "Sem categoria"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-white">
                  {Number(produto.estoque_atual).toLocaleString("pt-BR")}{" "}
                  <span className="text-xs text-slate-500">{produto.unidade}</span>
                </p>
                <p className="text-xs text-slate-500">
                  mín: {Number(produto.estoque_minimo).toLocaleString("pt-BR")}
                </p>
              </div>
              <StatusBadge status={produto.status_estoque as "baixo" | "zerado"} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

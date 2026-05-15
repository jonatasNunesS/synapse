"use client";

import Link from "next/link";
import {
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react";
import type { ProdutoList, StatusEstoque } from "@/types/estoque";

interface ProdutoTableProps {
  produtos: ProdutoList[];
  paginacao: { total: number; pagina: number; totalPaginas: number };
  loading?: boolean;
  onEditar?: (produto: ProdutoList) => void;
  onExcluir?: (produto: ProdutoList) => void;
  onPaginaChange?: (pagina: number) => void;
}

function StatusBadge({ status }: { status: StatusEstoque }) {
  const map = {
    ok: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    baixo: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    zerado: "bg-red-500/15 text-red-400 border-red-500/20",
  };
  const labels = { ok: "OK", baixo: "Baixo", zerado: "Zerado" };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-white/5">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-white/10 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function ProdutoTable({
  produtos,
  paginacao,
  loading,
  onEditar,
  onExcluir,
  onPaginaChange,
}: ProdutoTableProps) {
  if (!loading && produtos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Package className="h-12 w-12 text-slate-600 mb-3" />
        <p className="text-slate-400 font-medium">Nenhum produto encontrado</p>
        <p className="text-sm text-slate-500 mt-1">
          Cadastre seu primeiro produto para começar.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Produto
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                SKU
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Categoria
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Estoque
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Preço Venda
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : produtos.map((produto) => (
                  <tr
                    key={produto.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {produto.imagem_url ? (
                          <img
                            src={produto.imagem_url}
                            alt={produto.nome}
                            className="h-8 w-8 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <Package className="h-4 w-4 text-slate-500" />
                          </div>
                        )}
                        <span className="font-medium text-white truncate max-w-[180px]">
                          {produto.nome}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                      {produto.sku || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {produto.categoria_nome ? (
                        <div className="flex items-center gap-1.5">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: produto.categoria_cor || "#6b7280",
                            }}
                          />
                          <span className="text-slate-300 text-xs">
                            {produto.categoria_nome}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-white">
                        {Number(produto.estoque_atual).toLocaleString("pt-BR")}
                      </span>
                      <span className="text-slate-500 text-xs ml-1">
                        {produto.unidade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(Number(produto.preco_venda))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={produto.status_estoque} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/estoque/produtos/${produto.id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {onEditar && (
                          <button
                            onClick={() => onEditar(produto)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {onExcluir && (
                          <button
                            onClick={() => onExcluir(produto)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {paginacao.totalPaginas > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
          <p className="text-sm text-slate-400">
            {paginacao.total} produto{paginacao.total !== 1 ? "s" : ""} no total
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPaginaChange?.(paginacao.pagina - 1)}
              disabled={paginacao.pagina <= 1}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-slate-400">
              {paginacao.pagina} / {paginacao.totalPaginas}
            </span>
            <button
              onClick={() => onPaginaChange?.(paginacao.pagina + 1)}
              disabled={paginacao.pagina >= paginacao.totalPaginas}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

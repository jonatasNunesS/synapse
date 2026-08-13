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
    ok: "bg-emerald-500/15 text-sucesso border-emerald-500/20",
    baixo: "bg-amber-500/15 text-alerta border-amber-500/20",
    zerado: "bg-red-500/15 text-erro border-red-500/20",
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
    <tr className="border-b border-border">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-superficie-forte rounded animate-pulse" />
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
        <Package className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">Nenhum produto encontrado</p>
        <p className="text-sm text-muted-suave mt-1">
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
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Produto
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                SKU
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Categoria
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Estoque
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Preço Venda
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                    className="border-b border-border hover:bg-superficie transition-colors"
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
                          <div className="h-8 w-8 rounded-lg bg-superficie-forte flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-suave" />
                          </div>
                        )}
                        <span className="font-medium text-foreground truncate max-w-[180px]">
                          {produto.nome}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
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
                          <span className="text-foreground-suave text-xs">
                            {produto.categoria_nome}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-suave text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-foreground">
                        {Number(produto.estoque_atual).toLocaleString("pt-BR")}
                      </span>
                      <span className="text-muted-suave text-xs ml-1">
                        {produto.unidade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground-suave">
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
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-superficie-forte transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {onEditar && (
                          <button
                            onClick={() => onEditar(produto)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-info hover:bg-blue-500/10 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {onExcluir && (
                          <button
                            onClick={() => onExcluir(produto)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-erro hover:bg-red-500/10 transition-colors"
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {paginacao.total} produto{paginacao.total !== 1 ? "s" : ""} no total
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPaginaChange?.(paginacao.pagina - 1)}
              disabled={paginacao.pagina <= 1}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-superficie-forte disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-muted-foreground">
              {paginacao.pagina} / {paginacao.totalPaginas}
            </span>
            <button
              onClick={() => onPaginaChange?.(paginacao.pagina + 1)}
              disabled={paginacao.pagina >= paginacao.totalPaginas}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-superficie-forte disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

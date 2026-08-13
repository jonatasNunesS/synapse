"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Filter,
} from "lucide-react";
import { useFornecedores, useCategoriasFornecedor } from "@/hooks/useFornecedores";
import { ScoreSynapse } from "./ScoreSynapse";
import type { FornecedorList } from "@/types/fornecedores";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ativo: { label: "Ativo", color: "bg-emerald-500/15 text-sucesso border-emerald-500/30" },
  inativo: { label: "Inativo", color: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30" },
  suspenso: { label: "Suspenso", color: "bg-red-500/15 text-erro border-red-500/30" },
  em_avaliacao: { label: "Em Avaliação", color: "bg-amber-500/15 text-alerta border-amber-500/30" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? { label: status, color: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

interface FornecedorTableProps {
  onNovo: () => void;
}

export function FornecedorTable({ onNovo }: FornecedorTableProps) {
  const { data, total, loading, error, fetch } = useFornecedores();
  const { data: categorias, fetch: fetchCategorias } = useCategoriasFornecedor();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const load = useCallback(() => {
    fetch({ search, status: statusFilter, categoria: categoriaFilter, page });
  }, [fetch, search, statusFilter, categoriaFilter, page]);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="rounded-xl border border-border bg-superficie backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-foreground">Fornecedores</h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search — o input tem largura própria (20 caracteres); sem o
              w-full ele cresce com a fonte e empurra a página para fora. */}
          <div className="relative min-w-0 flex-1 basis-full sm:basis-auto">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-suave" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-8 w-full rounded-lg border border-border bg-superficie pl-8 pr-3 text-sm text-foreground placeholder-zinc-500 outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
            />
          </div>
          {/* Status filter */}
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-suave" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="h-8 rounded-lg border border-border bg-card shadow-elevacao pl-8 pr-3 text-sm text-foreground outline-none focus:border-brand-500/50"
            >
              <option value="">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="suspenso">Suspenso</option>
              <option value="em_avaliacao">Em Avaliação</option>
            </select>
          </div>
          {/* Categoria filter */}
          {categorias.length > 0 && (
            <select
              value={categoriaFilter}
              onChange={(e) => { setCategoriaFilter(e.target.value); setPage(1); }}
              className="h-8 rounded-lg border border-border bg-card shadow-elevacao px-3 text-sm text-foreground outline-none focus:border-brand-500/50"
            >
              <option value="">Todas as categorias</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          )}
          <button
            onClick={onNovo}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white transition-colors hover:bg-brand-500"
          >
            <Plus className="h-4 w-4" />
            Novo
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-suave">Fornecedor</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-suave">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-suave">Score</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-suave">Total Gasto</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-suave">Pedidos</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-suave">Última Compra</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-suave">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-suave">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    Carregando...
                  </div>
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-erro">{error}</td>
              </tr>
            )}
            {!loading && !error && data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-suave">
                  Nenhum fornecedor encontrado.
                </td>
              </tr>
            )}
            {!loading && data.map((f: FornecedorList) => (
              <tr
                key={f.id}
                className="border-b border-border transition-colors hover:bg-superficie"
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{f.nome}</span>
                    {f.categoria_nome && (
                      <span className="text-xs text-muted-suave">{f.categoria_nome}</span>
                    )}
                    {f.email && (
                      <span className="text-xs text-muted-foreground">{f.email}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={f.status} />
                </td>
                <td className="px-4 py-3">
                  <ScoreSynapse score={f.score_synapse} size="sm" showLabel={false} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground-suave">
                  {formatCurrency(f.valor_total_compras)}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {f.quantidade_pedidos}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {f.ultima_compra
                    ? new Date(f.ultima_compra).toLocaleDateString("pt-BR")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {f.link_whatsapp && (
                      <a
                        href={f.link_whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded p-1 text-sucesso transition-colors hover:bg-emerald-500/10"
                        title="WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                    <Link
                      href={`/fornecedores/${f.id}`}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-superficie-forte hover:text-foreground"
                      title="Ver detalhes"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-xs text-muted-suave">
            {total} fornecedor{total !== 1 ? "es" : ""}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-superficie-forte disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-superficie-forte disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

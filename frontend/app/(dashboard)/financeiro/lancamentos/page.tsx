"use client";

import { ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { LancamentoForm } from "@/components/financeiro/LancamentoForm";
import { LancamentoTable } from "@/components/financeiro/LancamentoTable";
import { PagarModal } from "@/components/financeiro/PagarModal";
import {
  useCategorias,
  useLancamentos,
} from "@/hooks/useFinanceiro";
import type {
  FiltrosLancamento,
  Lancamento,
  LancamentoCreate,
  TipoFinanceiro,
  StatusLancamento,
} from "@/types/financeiro";

const PAGE_SIZE = 25;

export default function LancamentosPage() {
  const [filtros, setFiltros] = useState<FiltrosLancamento>({ page: 1 });
  const [busca, setBusca] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [lancamentoParaPagar, setLancamentoParaPagar] =
    useState<Lancamento | null>(null);

  const { categorias } = useCategorias();
  const {
    lancamentos,
    total,
    loading,
    criar,
    deletar,
    pagar,
  } = useLancamentos({ ...filtros, busca });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const atualizarFiltro = (chave: keyof FiltrosLancamento, valor: string) => {
    setFiltros((prev) => ({
      ...prev,
      [chave]: valor || undefined,
      page: 1,
    }));
  };

  const limparFiltros = () => {
    setFiltros({ page: 1 });
    setBusca("");
  };

  const temFiltros =
    !!filtros.tipo ||
    !!filtros.status ||
    !!filtros.categoria_id ||
    !!filtros.data_inicio ||
    !!filtros.data_fim ||
    !!busca;

  const handleCriar = async (dados: LancamentoCreate) => {
    await criar(dados);
    setMostrarForm(false);
  };

  const handlePagar = async (dataPagamento: string) => {
    if (!lancamentoParaPagar) return;
    await pagar(lancamentoParaPagar.id, { data_pagamento: dataPagamento });
    setLancamentoParaPagar(null);
  };

  const handleDeletar = async (lancamento: Lancamento) => {
    if (!confirm(`Excluir "${lancamento.descricao}"?`)) return;
    await deletar(lancamento.id);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Lançamentos</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {total} lançamento{total !== 1 ? "s" : ""} encontrado
            {total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setMostrarForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-white transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Novo Lançamento
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Busca */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por descrição..."
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Tipo */}
          <select
            value={filtros.tipo ?? ""}
            onChange={(e) =>
              atualizarFiltro("tipo", e.target.value as TipoFinanceiro)
            }
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
          >
            <option value="">Todos os tipos</option>
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>

          {/* Status */}
          <select
            value={filtros.status ?? ""}
            onChange={(e) =>
              atualizarFiltro("status", e.target.value as StatusLancamento)
            }
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
          >
            <option value="">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="atrasado">Atrasado</option>
            <option value="cancelado">Cancelado</option>
          </select>

          {/* Categoria */}
          <select
            value={filtros.categoria_id ?? ""}
            onChange={(e) => atualizarFiltro("categoria_id", e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
          >
            <option value="">Todas as categorias</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nome} ({cat.tipo})
              </option>
            ))}
          </select>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">
              De:
            </label>
            <input
              type="date"
              value={filtros.data_inicio ?? ""}
              onChange={(e) => atualizarFiltro("data_inicio", e.target.value)}
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">
              Até:
            </label>
            <input
              type="date"
              value={filtros.data_fim ?? ""}
              onChange={(e) => atualizarFiltro("data_fim", e.target.value)}
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
        </div>

        {temFiltros && (
          <button
            onClick={limparFiltros}
            className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl">
        <LancamentoTable
          lancamentos={lancamentos}
          loading={loading}
          onPagar={setLancamentoParaPagar}
          onDeletar={handleDeletar}
        />

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
            <p className="text-xs text-slate-500">
              Página {filtros.page ?? 1} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setFiltros((p) => ({ ...p, page: Math.max(1, (p.page ?? 1) - 1) }))
                }
                disabled={(filtros.page ?? 1) <= 1}
                className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setFiltros((p) => ({
                    ...p,
                    page: Math.min(totalPages, (p.page ?? 1) + 1),
                  }))
                }
                disabled={(filtros.page ?? 1) >= totalPages}
                className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {mostrarForm && (
        <LancamentoForm
          categorias={categorias}
          onSubmit={handleCriar}
          onClose={() => setMostrarForm(false)}
        />
      )}

      {lancamentoParaPagar && (
        <PagarModal
          lancamento={lancamentoParaPagar}
          onConfirmar={handlePagar}
          onClose={() => setLancamentoParaPagar(null)}
        />
      )}
    </div>
  );
}

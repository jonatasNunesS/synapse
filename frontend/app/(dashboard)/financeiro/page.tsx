"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  HandCoins,
  PiggyBank,
  Plus,
  Repeat,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CategoriaFinanceiroModal } from "@/components/financeiro/CategoriaFinanceiroModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getErrorMessage } from "@/lib/api";
import { FluxoCaixaChart } from "@/components/financeiro/FluxoCaixaChart";
import { LancamentoForm } from "@/components/financeiro/LancamentoForm";
import { LancamentoTable } from "@/components/financeiro/LancamentoTable";
import { PagarModal } from "@/components/financeiro/PagarModal";
import { SaldoResumo, type FiltroMetrica } from "@/components/financeiro/SaldoResumo";
import {
  useCategorias,
  useFluxoCaixa,
  useLancamentos,
  useSaldoFinanceiro,
} from "@/hooks/useFinanceiro";
import type { Lancamento, LancamentoCreate } from "@/types/financeiro";

export default function FinanceiroPage() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarCategorias, setMostrarCategorias] = useState(false);
  const [lancamentoParaPagar, setLancamentoParaPagar] =
    useState<Lancamento | null>(null);
  const [lancamentoParaExcluir, setLancamentoParaExcluir] =
    useState<Lancamento | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  // Filtro por card de métrica (clicar em "A receber" mostra só esses).
  const [filtroMetrica, setFiltroMetrica] = useState<FiltroMetrica | null>(null);

  // Primeiro e último dia do mês selecionado
  const dataInicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataFim = `${ano}-${String(mes).padStart(2, "0")}-${ultimoDia}`;

  const { saldo, loading: loadingSaldo, recarregar: recarregarSaldo } =
    useSaldoFinanceiro(mes, ano);
  const { fluxo, loading: loadingFluxo } = useFluxoCaixa(dataInicio, dataFim);
  const { categorias } = useCategorias();
  const {
    lancamentos,
    total,
    loading: loadingLancamentos,
    criar,
    deletar,
    pagar,
  } = useLancamentos({
    data_inicio: dataInicio,
    data_fim: dataFim,
    tipo: filtroMetrica?.tipo,
    status: filtroMetrica?.status,
  });

  const mesPorExtenso = format(new Date(ano, mes - 1, 1), "MMMM yyyy", {
    locale: ptBR,
  });

  const navegarMes = (direcao: -1 | 1) => {
    const novaData = new Date(ano, mes - 1 + direcao, 1);
    setMes(novaData.getMonth() + 1);
    setAno(novaData.getFullYear());
  };

  const handleCriarLancamento = async (dados: LancamentoCreate) => {
    await criar(dados);
    setMostrarForm(false);
    recarregarSaldo();
  };

  const handlePagar = async (dataPagamento: string) => {
    if (!lancamentoParaPagar) return;
    await pagar(lancamentoParaPagar.id, { data_pagamento: dataPagamento });
    setLancamentoParaPagar(null);
    recarregarSaldo();
  };

  const handleDeletar = (lancamento: Lancamento) => {
    setLancamentoParaExcluir(lancamento);
  };

  const handleConfirmarExclusao = async () => {
    if (!lancamentoParaExcluir || excluindo) return; // evita duplo clique
    setExcluindo(true);
    try {
      await deletar(lancamentoParaExcluir.id);
      toast.success("Lançamento excluído.");
      setLancamentoParaExcluir(null);
      recarregarSaldo();
    } catch (err) {
      // Erro NUNCA calado: mostra a mensagem real do backend
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Financeiro</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Gestão de receitas, despesas e fluxo de caixa
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Navegação de mês */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <button
              onClick={() => navegarMes(-1)}
              className="p-1 rounded hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-white capitalize min-w-[120px] text-center">
              {mesPorExtenso}
            </span>
            <button
              onClick={() => navegarMes(1)}
              className="p-1 rounded hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Botão novo lançamento */}
          <button
            onClick={() => setMostrarForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Lançamento</span>
          </button>
          <button
            onClick={() => setMostrarCategorias(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-slate-300 transition-colors"
          >
            <Tag className="w-4 h-4" />
            <span className="hidden sm:inline">Gerenciar Categorias</span>
          </button>
          <Link
            href="/financeiro/recorrencias"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-slate-300 transition-colors"
          >
            <Repeat className="w-4 h-4" />
            <span className="hidden sm:inline">Recorrências</span>
          </Link>
          <Link
            href="/financeiro/caixinhas"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-slate-300 transition-colors"
          >
            <PiggyBank className="w-4 h-4" />
            <span className="hidden sm:inline">Caixinhas</span>
          </Link>
          <Link
            href="/financeiro/emprestimos"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-slate-300 transition-colors"
          >
            <HandCoins className="w-4 h-4" />
            <span className="hidden sm:inline">Empréstimos</span>
          </Link>
        </div>
      </div>

      {/* Saldos (acumulado + do mês) e as 4 métricas do período */}
      <SaldoResumo
        saldo={saldo}
        loading={loadingSaldo}
        filtroAtivo={filtroMetrica}
        onFiltrar={setFiltroMetrica}
      />

      {/* Fluxo de caixa */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">
          Fluxo de Caixa — {mesPorExtenso}
        </h2>
        <FluxoCaixaChart dados={fluxo} loading={loadingFluxo} />
      </div>

      {/* Tabela de lançamentos */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="text-base font-semibold text-white">Lançamentos</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {total} lançamento{total !== 1 ? "s" : ""} no período
              {filtroMetrica && (
                <>
                  {" · "}
                  <button
                    onClick={() => setFiltroMetrica(null)}
                    className="text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    filtrado ({filtroMetrica.tipo}/{filtroMetrica.status}) — limpar
                  </button>
                </>
              )}
            </p>
          </div>
          <a
            href="/financeiro/lancamentos"
            className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            Ver todos →
          </a>
        </div>
        <LancamentoTable
          lancamentos={lancamentos}
          loading={loadingLancamentos}
          onPagar={setLancamentoParaPagar}
          onDeletar={handleDeletar}
        />
      </div>

      {/* Modals */}
      {mostrarForm && (
        <LancamentoForm
          categorias={categorias}
          onSubmit={handleCriarLancamento}
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

      {mostrarCategorias && (
        <CategoriaFinanceiroModal onClose={() => setMostrarCategorias(false)} />
      )}

      <ConfirmDialog
        open={!!lancamentoParaExcluir}
        titulo="Excluir lançamento"
        mensagem={
          <>
            Excluir{" "}
            <span className="text-white font-medium">
              {lancamentoParaExcluir?.descricao}
            </span>
            ? Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir"
        processando={excluindo}
        onConfirm={handleConfirmarExclusao}
        onCancel={() => setLancamentoParaExcluir(null)}
      />
    </div>
  );
}

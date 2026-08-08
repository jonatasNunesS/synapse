"use client";

/**
 * Synapse — Caixinhas (reservas financeiras, modelo Nubank).
 * Grid de cards + saldo disponível/total em caixinhas no topo.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, PiggyBank, Plus } from "lucide-react";
import { toast } from "sonner";
import { CaixinhaCard, moedaCaixinha } from "@/components/caixinhas/CaixinhaCard";
import { CaixinhaFormModal } from "@/components/caixinhas/CaixinhaFormModal";
import { MovimentosCaixinhaModal } from "@/components/caixinhas/MovimentosCaixinhaModal";
import { OperacaoCaixinhaModal } from "@/components/caixinhas/OperacaoCaixinhaModal";
import { useCaixinhas } from "@/hooks/useCaixinhas";
import { useSaldoFinanceiro } from "@/hooks/useFinanceiro";
import type { Caixinha, CaixinhaCreate } from "@/types/caixinhas";
import { getErrorMessage } from "@/lib/api";

export default function CaixinhasPage() {
  const {
    caixinhas,
    loading,
    criar,
    atualizar,
    deletar,
    depositar,
    retirar,
  } = useCaixinhas();
  const { saldo, recarregar: recarregarSaldo } = useSaldoFinanceiro();

  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Caixinha | null>(null);
  const [operacao, setOperacao] = useState<{
    caixinha: Caixinha;
    tipo: "deposito" | "retirada";
  } | null>(null);
  const [detalhe, setDetalhe] = useState<Caixinha | null>(null);

  const totalEmCaixinhas = caixinhas.reduce(
    (soma, c) => soma + parseFloat(c.saldo),
    0
  );

  const handleCriar = async (dados: CaixinhaCreate) => {
    await criar(dados);
    toast.success("Caixinha criada!");
    setMostrarForm(false);
  };

  const handleEditar = async (dados: CaixinhaCreate) => {
    if (!editando) return;
    await atualizar(editando.id, dados);
    toast.success("Caixinha atualizada.");
    setEditando(null);
    setDetalhe(null);
  };

  const handleExcluir = async () => {
    if (!editando) return;
    await deletar(editando.id); // 400 com saldo > 0 — erro exibido no modal
    toast.success("Caixinha excluída.");
    setEditando(null);
    setDetalhe(null);
  };

  const handleOperacao = async (valor: string, descricao: string) => {
    if (!operacao) return;
    const { caixinha, tipo } = operacao;
    if (tipo === "deposito") {
      await depositar(caixinha.id, valor, descricao);
      toast.success(`${moedaCaixinha(valor)} guardado em "${caixinha.nome}".`);
    } else {
      await retirar(caixinha.id, valor, descricao);
      toast.success(
        `${moedaCaixinha(valor)} devolvido ao saldo disponível.`
      );
    }
    setOperacao(null);
    recarregarSaldo();
  };

  const handleApagarComErroVisivel = async () => {
    try {
      await handleExcluir();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
      throw err; // o modal também mostra a mensagem
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/financeiro"
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <PiggyBank className="w-6 h-6 text-brand-400" />
              Caixinhas
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Saldo disponível:{" "}
              <span className="text-white font-medium">
                {moedaCaixinha(saldo?.saldo_disponivel ?? 0)}
              </span>
              <span className="mx-2">·</span>
              Total em caixinhas:{" "}
              <span className="text-brand-300 font-medium">
                {moedaCaixinha(totalEmCaixinhas)}
              </span>
            </p>
          </div>
        </div>
        <button
          onClick={() => setMostrarForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-sm font-medium text-white transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nova Caixinha
        </button>
      </div>

      {/* Grid de cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-xl border border-white/10 bg-white/5 animate-pulse"
            />
          ))}
        </div>
      ) : caixinhas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <PiggyBank className="w-12 h-12 text-slate-600 mb-3" />
          <p className="text-slate-400">
            Nenhuma caixinha ainda. Separe dinheiro do seu saldo para
            reservas e metas.
          </p>
          <button
            onClick={() => setMostrarForm(true)}
            className="mt-4 text-brand-400 hover:text-brand-300 text-sm transition-colors"
          >
            Criar primeira caixinha
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {caixinhas.map((caixinha) => (
            <CaixinhaCard
              key={caixinha.id}
              caixinha={caixinha}
              onDepositar={(c) => setOperacao({ caixinha: c, tipo: "deposito" })}
              onRetirar={(c) => setOperacao({ caixinha: c, tipo: "retirada" })}
              onAbrir={setDetalhe}
            />
          ))}
        </div>
      )}

      {/* Modais */}
      {mostrarForm && (
        <CaixinhaFormModal
          onSubmit={handleCriar}
          onClose={() => setMostrarForm(false)}
        />
      )}

      {editando && (
        <CaixinhaFormModal
          caixinha={editando}
          onSubmit={handleEditar}
          onDelete={handleApagarComErroVisivel}
          onClose={() => setEditando(null)}
        />
      )}

      {operacao && (
        <OperacaoCaixinhaModal
          caixinha={operacao.caixinha}
          tipo={operacao.tipo}
          saldoDisponivel={saldo?.saldo_disponivel ?? null}
          onConfirm={handleOperacao}
          onClose={() => setOperacao(null)}
        />
      )}

      {detalhe && !editando && (
        <MovimentosCaixinhaModal
          caixinha={detalhe}
          onEditar={(c) => setEditando(c)}
          onClose={() => setDetalhe(null)}
        />
      )}
    </div>
  );
}

"use client";

/**
 * Synapse — Empréstimos (tipo de lançamento). Lista com filtro e ações.
 * Clicar numa notificação do sino leva aqui com ?destaque={id}, que abre
 * automaticamente o modal de ação daquele empréstimo.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, HandCoins } from "lucide-react";
import { toast } from "sonner";
import { EmprestimoAcaoModal } from "@/components/financeiro/EmprestimoAcaoModal";
import { useEmprestimos, type FiltroEmprestimo } from "@/hooks/useEmprestimos";
import type { Lancamento, StatusEmprestimo } from "@/types/financeiro";

function moeda(v: number | string): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n || 0
  );
}

function data(d: string | null): string {
  if (!d) return "—";
  return new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR");
}

const STATUS_STYLE: Record<StatusEmprestimo, { label: string; cls: string }> = {
  aberto: { label: "Aberto", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  atrasado: { label: "Atrasado", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  quitado: { label: "Quitado", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  perdoado: { label: "Perdoado", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  "": { label: "—", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
};

const FILTROS: { value: FiltroEmprestimo; label: string }[] = [
  { value: "aberto", label: "Abertos" },
  { value: "quitado", label: "Quitados" },
  { value: "todos", label: "Todos" },
];

export default function EmprestimosPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-white/5" />}>
      <EmprestimosConteudo />
    </Suspense>
  );
}

function EmprestimosConteudo() {
  const searchParams = useSearchParams();
  const destaque = searchParams.get("destaque");
  const { emprestimos, filtro, setFiltro, loading, quitar, adiar } = useEmprestimos("aberto");
  const [acaoEmprestimo, setAcaoEmprestimo] = useState<Lancamento | null>(null);

  // Abre o modal do empréstimo destacado (vindo da notificação)
  useEffect(() => {
    if (!destaque) return;
    const alvo = emprestimos.find((e) => e.id === destaque);
    if (alvo) setAcaoEmprestimo(alvo);
  }, [destaque, emprestimos]);

  const handleQuitar = async (id: string, perdoar: boolean) => {
    await quitar(id, perdoar);
    toast.success(perdoar ? "Empréstimo encerrado — valor não retorna ao saldo." : "Empréstimo quitado!");
    setAcaoEmprestimo(null);
  };

  const handleAdiar = async (id: string, dias: number) => {
    await adiar(id, dias);
    toast.success(`Prazo adiado em ${dias} dia${dias > 1 ? "s" : ""}.`);
    setAcaoEmprestimo(null);
  };

  const vazio = useMemo(() => !loading && emprestimos.length === 0, [loading, emprestimos]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/financeiro"
          className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <HandCoins className="w-6 h-6 text-amber-400" />
            Empréstimos
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Dinheiro que você emprestou ou pegou emprestado, com data de retorno.
          </p>
        </div>
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filtro === f.value
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl divide-y divide-white/5">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse bg-white/[0.02]" />
          ))
        ) : vazio ? (
          <div className="py-16 text-center text-slate-500">
            <HandCoins className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p>Nenhum empréstimo {filtro === "aberto" ? "aberto" : ""} por aqui.</p>
          </div>
        ) : (
          emprestimos.map((emp) => {
            const st = STATUS_STYLE[emp.status_emprestimo];
            const atrasado = emp.status_emprestimo === "atrasado";
            const emprestei = emp.direcao_emprestimo === "emprestei";
            return (
              <div
                key={emp.id}
                className={`flex items-center gap-4 p-4 ${atrasado ? "bg-red-500/[0.04]" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {emp.pessoa_emprestimo || emp.descricao}
                    <span className="ml-2 text-xs text-slate-500">
                      {emprestei ? "você emprestou" : "você pegou emprestado"}
                    </span>
                  </p>
                  <p className={`text-xs mt-0.5 ${atrasado ? "text-red-400" : "text-slate-500"}`}>
                    Retorno: {data(emp.data_retorno_esperado)}
                    {emp.emprestimo_quitado && emp.data_quitacao
                      ? ` · quitado em ${data(emp.data_quitacao)}`
                      : ""}
                  </p>
                </div>
                <span className={`text-sm font-semibold tabular-nums ${emprestei ? "text-amber-400" : "text-blue-300"}`}>
                  {moeda(emp.valor)}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${st.cls}`}>
                  {st.label}
                </span>
                {!emp.emprestimo_quitado ? (
                  <button
                    onClick={() => setAcaoEmprestimo(emp)}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-medium text-white transition-colors"
                  >
                    {emprestei ? "Recebi / Adiar" : "Devolvi / Adiar"}
                  </button>
                ) : (
                  <span className="w-[92px]" />
                )}
              </div>
            );
          })
        )}
      </div>

      {acaoEmprestimo && (
        <EmprestimoAcaoModal
          emprestimo={acaoEmprestimo}
          onQuitar={handleQuitar}
          onAdiar={handleAdiar}
          onClose={() => setAcaoEmprestimo(null)}
        />
      )}
    </div>
  );
}

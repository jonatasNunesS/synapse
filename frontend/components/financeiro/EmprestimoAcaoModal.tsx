"use client";

/**
 * Synapse — Modal de ação sobre um empréstimo (confirmar / adiar / perdoar).
 *
 * Reutilizado pela página de empréstimos E pelo clique na notificação do sino
 * (a notificação leva a /financeiro/emprestimos?destaque={id}, que abre este
 * modal). Os botões mudam conforme a direção:
 *   emprestei         → [Recebeu ✓] [Adiar] [Perdoar]
 *   peguei_emprestado → [Devolvi ✓] [Adiar] [Cancelar]
 */

import { useState } from "react";
import { CalendarClock, Check, Loader2, X } from "lucide-react";
import type { Lancamento } from "@/types/financeiro";
import { getErrorMessage } from "@/lib/api";

function moeda(v: number | string): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n || 0
  );
}

interface EmprestimoAcaoModalProps {
  emprestimo: Lancamento;
  onQuitar: (id: string, perdoar: boolean) => Promise<void>;
  onAdiar: (id: string, dias: number) => Promise<void>;
  onClose: () => void;
}

export function EmprestimoAcaoModal({
  emprestimo,
  onQuitar,
  onAdiar,
  onClose,
}: EmprestimoAcaoModalProps) {
  const emprestei = emprestimo.direcao_emprestimo === "emprestei";
  const pessoa = emprestimo.pessoa_emprestimo || "alguém";
  const [modoAdiar, setModoAdiar] = useState(false);
  const [dias, setDias] = useState("7");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setProcessando(true);
    setErro(null);
    try {
      await fn();
    } catch (err) {
      setErro(getErrorMessage(err));
    } finally {
      setProcessando(false);
    }
  };

  const diasNum = parseInt(dias, 10);
  const diasValido = !isNaN(diasNum) && diasNum >= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Empréstimo</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-200">
            {emprestei ? (
              <>
                <span className="font-medium">{pessoa}</span> ficou de te devolver{" "}
                <span className="font-semibold text-amber-400">{moeda(emprestimo.valor)}</span>.
              </>
            ) : (
              <>
                Você ficou de devolver{" "}
                <span className="font-semibold text-amber-400">{moeda(emprestimo.valor)}</span>{" "}
                pro/pra <span className="font-medium">{pessoa}</span>.
              </>
            )}
          </p>

          {!modoAdiar ? (
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => run(() => onQuitar(emprestimo.id, false))}
                disabled={processando}
                className="inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {emprestei ? "Recebeu" : "Devolvi"}
              </button>
              <button
                onClick={() => setModoAdiar(true)}
                disabled={processando}
                className="inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <CalendarClock className="w-4 h-4" />
                Adiar prazo
              </button>
              <button
                onClick={() => run(() => onQuitar(emprestimo.id, true))}
                disabled={processando}
                className="inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                {emprestei ? "Perdoar dívida" : "Dívida cancelada"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-300">
                Adiar em quantos dias?
              </label>
              <input
                type="number"
                min={1}
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setModoAdiar(false)}
                  disabled={processando}
                  className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  onClick={() => run(() => onAdiar(emprestimo.id, diasNum))}
                  disabled={!diasValido || processando}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-medium text-white transition-colors disabled:opacity-50"
                >
                  {processando && <Loader2 className="w-4 h-4 animate-spin" />}
                  Adiar {diasValido ? `${diasNum} dia${diasNum > 1 ? "s" : ""}` : ""}
                </button>
              </div>
            </div>
          )}

          {erro && (
            <p className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
              {erro}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

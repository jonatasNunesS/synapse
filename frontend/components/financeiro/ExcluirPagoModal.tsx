"use client";

/**
 * Synapse — Exclusão de lançamento PAGO (fluxo auditado, admin-only).
 *
 * Confirmação forte, no padrão do TrocarPlanoModal:
 * - Aviso de impacto (âmbar)
 * - Digitar a descrição exata do lançamento para destravar
 * - Motivo obrigatório (5+ caracteres)
 * O backend registra log de auditoria com snapshot completo antes de excluir.
 */

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import type { Lancamento } from "@/types/financeiro";

const MOTIVO_MIN = 5;
const MOTIVO_MAX = 500;

interface ExcluirPagoModalProps {
  lancamento: Lancamento;
  onConfirm: (motivo: string) => Promise<void>;
  onClose: () => void;
}

export function ExcluirPagoModal({
  lancamento,
  onConfirm,
  onClose,
}: ExcluirPagoModalProps) {
  const [confirmacao, setConfirmacao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const nomeConfere = confirmacao.trim() === lancamento.descricao.trim();
  const motivoValido =
    motivo.trim().length >= MOTIVO_MIN && motivo.trim().length <= MOTIVO_MAX;
  const podeExcluir = nomeConfere && motivoValido && !excluindo;

  const excluir = async () => {
    if (!podeExcluir) return;
    setExcluindo(true);
    try {
      await onConfirm(motivo.trim());
    } finally {
      setExcluindo(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" />
            Excluir lançamento pago
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Aviso de impacto */}
          <div
            role="alert"
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-200 space-y-1">
                <p className="font-semibold text-amber-300">
                  Esta exclusão afeta saldos e análises já geradas.
                </p>
                <p>
                  O saldo acumulado da empresa e o saldo do mês deste lançamento
                  serão recalculados. A operação fica registrada no log de
                  auditoria e não pode ser desfeita.
                </p>
              </div>
            </div>
          </div>

          {/* Confirmação por digitação */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Para confirmar, digite a descrição exata do lançamento:
            </label>
            <p className="text-xs text-slate-500 mb-2 font-mono bg-white/5 rounded px-2 py-1 inline-block">
              {lancamento.descricao}
            </p>
            <input
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder="Digite a descrição do lançamento"
              className={inputClass}
            />
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Por que está excluindo? (obrigatório)
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              maxLength={MOTIVO_MAX}
              placeholder="Ex: lançamento duplicado, pagamento estornado pelo banco..."
              className={`${inputClass} resize-none`}
            />
            <p className="mt-1 text-xs text-slate-500">
              {motivo.trim().length < MOTIVO_MIN
                ? `Mínimo ${MOTIVO_MIN} caracteres (${motivo.trim().length}/${MOTIVO_MIN}).`
                : `${motivo.trim().length}/${MOTIVO_MAX} caracteres.`}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={excluindo}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={excluir}
            disabled={!podeExcluir}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
          >
            {excluindo && <Loader2 className="w-4 h-4 animate-spin" />}
            Excluir definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";
/**
 * Synapse — Diálogo de confirmação reutilizável.
 * Substitui o window.confirm() nativo (que some sem sinal em alguns contextos).
 * - Botão "Cancelar" sempre visível.
 * - Botão de confirmar mostra spinner e fica DESABILITADO enquanto processa
 *   (evita duplo clique / requisição duplicada).
 * - Não fecha sozinho no erro: quem chama dá o toast e o modal continua aberto
 *   para o usuário ver a mensagem e tentar de novo ou cancelar.
 */
import { Loader2, AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  titulo: string;
  mensagem: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  processando?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  titulo,
  mensagem,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  processando = false,
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !processando && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            {danger && (
              <div className="h-9 w-9 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">{titulo}</h2>
              <div className="text-sm text-slate-400 mt-1">{mensagem}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-white/10">
          <button
            onClick={onCancel}
            disabled={processando}
            className="px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={processando}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              danger
                ? "bg-red-600 hover:bg-red-500"
                : "bg-brand-600 hover:bg-brand-500"
            }`}
          >
            {processando && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

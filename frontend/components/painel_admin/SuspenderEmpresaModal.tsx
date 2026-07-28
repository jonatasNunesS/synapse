"use client";
/**
 * Modal de suspensão de empresa. Motivo obrigatório (min 10 chars). A empresa
 * suspensa continua logando, mas seus usuários veem a tela de aviso.
 */
import { useState } from "react";
import { toast } from "sonner";
import { X, Loader2, PauseCircle } from "lucide-react";
import { suspenderEmpresa } from "@/hooks/usePainelAdmin";
import { getErrorMessage } from "@/lib/api";

interface Props {
  empresaId: string;
  empresaNome: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function SuspenderEmpresaModal({ empresaId, empresaNome, onClose, onSuccess }: Props) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const valido = motivo.trim().length >= 10;

  const suspender = async () => {
    if (!valido || enviando) return;
    setEnviando(true);
    try {
      await suspenderEmpresa(empresaId, motivo.trim());
      toast.success(`Empresa ${empresaNome} suspensa.`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <PauseCircle className="h-4 w-4 text-red-400" />
            Suspender empresa
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-300">
            <span className="font-medium text-white">{empresaNome}</span> ficará suspensa. Os
            usuários ainda conseguem entrar, mas verão um aviso e não acessam o sistema. Os dados
            são preservados.
          </p>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Motivo da suspensão <span className="text-red-400">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo (mínimo 10 caracteres)…"
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {motivo.trim().length}/10 caracteres mínimos
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={suspender}
            disabled={!valido || enviando}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            Suspender
          </button>
        </div>
      </div>
    </div>
  );
}

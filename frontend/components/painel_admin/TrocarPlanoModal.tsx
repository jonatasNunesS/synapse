"use client";
/**
 * Modal de troca de plano com confirmação por digitação do nome da empresa —
 * evita clique acidental numa operação sensível de plataforma.
 */
import { useState } from "react";
import { toast } from "sonner";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { trocarPlano } from "@/hooks/usePainelAdmin";
import { getErrorMessage } from "@/lib/api";
import { PLANOS, type Plano } from "@/types/painel_admin";

interface Props {
  empresaId: string;
  empresaNome: string;
  planoAtual: Plano;
  onClose: () => void;
  onSuccess: () => void;
}

export function TrocarPlanoModal({
  empresaId,
  empresaNome,
  planoAtual,
  onClose,
  onSuccess,
}: Props) {
  const [planoNovo, setPlanoNovo] = useState<Plano>(planoAtual);
  const [observacao, setObservacao] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);

  const nomeConfere = confirmacao.trim() === empresaNome.trim();

  const confirmar = async () => {
    if (!nomeConfere || enviando) return;
    setEnviando(true);
    try {
      await trocarPlano(empresaId, planoNovo, observacao.trim());
      toast.success(`Plano alterado para "${planoNovo}".`);
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
          <h2 className="text-sm font-semibold text-white">Trocar plano</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-sm text-slate-300">
              Empresa: <span className="font-medium text-white">{empresaNome}</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Plano atual: <span className="text-slate-300">{planoAtual}</span>
            </p>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Novo plano</label>
            <select
              value={planoNovo}
              onChange={(e) => setPlanoNovo(e.target.value as Plano)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {PLANOS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Observação (opcional)
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Motivo da troca, ticket, combinação com o cliente…"
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Confirmação por digitação do nome */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-3">
            <p className="text-xs text-amber-300 flex items-start gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              Para confirmar, digite o nome exato da empresa:
              <span className="font-semibold">{empresaNome}</span>
            </p>
            <input
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder="Nome da empresa"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
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
            onClick={confirmar}
            disabled={!nomeConfere || enviando}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-medium hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar troca
          </button>
        </div>
      </div>
    </div>
  );
}

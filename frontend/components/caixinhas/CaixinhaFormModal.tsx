"use client";

/**
 * Synapse — Modal de nova/editar caixinha.
 * Nome (obrigatório), cor (preset padrão do sistema), ícone/emoji e
 * meta opcionais. Também permite excluir (só com saldo zerado — o
 * backend bloqueia com saldo e o erro aparece no modal).
 */

import { useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import type { Caixinha, CaixinhaCreate } from "@/types/caixinhas";
import { getErrorMessage } from "@/lib/api";

// Mesma paleta do CategoriaFinanceiroModal (padrão do sistema)
const CORES_PRESET = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4", "#64748b", "#78716c",
];

const EMOJIS_SUGERIDOS = ["🎯", "🎄", "💒", "🏖️", "🚗", "🏠", "📚", "💰"];

interface CaixinhaFormModalProps {
  caixinha?: Caixinha | null;
  onSubmit: (dados: CaixinhaCreate) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export function CaixinhaFormModal({
  caixinha,
  onSubmit,
  onDelete,
  onClose,
}: CaixinhaFormModalProps) {
  const modoEdicao = !!caixinha;
  const [nome, setNome] = useState(caixinha?.nome ?? "");
  const [cor, setCor] = useState(caixinha?.cor ?? CORES_PRESET[0]);
  const [icone, setIcone] = useState(caixinha?.icone ?? "");
  const [meta, setMeta] = useState(caixinha?.meta ?? "");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const metaNum = meta ? parseFloat(String(meta).replace(",", ".")) : null;
  const valido =
    nome.trim().length >= 2 && (meta === "" || (metaNum !== null && metaNum > 0));

  const salvar = async () => {
    if (!valido || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      await onSubmit({
        nome: nome.trim(),
        cor,
        icone: icone.trim(),
        meta: meta === "" ? null : metaNum!.toFixed(2),
      });
    } catch (err) {
      setErro(getErrorMessage(err));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!onDelete || excluindo) return;
    setExcluindo(true);
    setErro(null);
    try {
      await onDelete();
    } catch (err) {
      setErro(getErrorMessage(err)); // ex.: "Retire o saldo antes de excluir."
    } finally {
      setExcluindo(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {modoEdicao ? "Editar caixinha" : "Nova caixinha"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Nome *
            </label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={100}
              placeholder='Ex: "Reserva de emergência", "13º salário"'
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Cor
            </label>
            <div className="flex flex-wrap gap-2">
              {CORES_PRESET.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  aria-label={`Cor ${c}`}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    cor === c ? "ring-2 ring-white scale-110" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Ícone (opcional)
            </label>
            <div className="flex items-center gap-2">
              <input
                value={icone}
                onChange={(e) => setIcone(e.target.value)}
                maxLength={10}
                placeholder="🎯"
                className={`${inputClass} w-20 text-center`}
              />
              <div className="flex flex-wrap gap-1">
                {EMOJIS_SUGERIDOS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setIcone(e)}
                    className="w-7 h-7 rounded hover:bg-white/10 transition-colors"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Meta (opcional, R$)
            </label>
            <input
              value={meta ?? ""}
              onChange={(e) => setMeta(e.target.value)}
              placeholder="Ex: 2000,00"
              inputMode="decimal"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-500">
              Com meta definida, o card mostra a barra de progresso.
            </p>
          </div>

          {erro && (
            <p className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
              {erro}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-white/10">
          {modoEdicao && onDelete ? (
            <button
              onClick={excluir}
              disabled={excluindo || salvando}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              title="Excluir caixinha (precisa estar com saldo zerado)"
            >
              {excluindo ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Excluir
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={salvando || excluindo}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={!valido || salvando || excluindo}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
              {modoEdicao ? "Salvar" : "Criar caixinha"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
/**
 * Modal de decisão de uma ocorrência (a "pergunta" do sino).
 * Chegou o dia: confirmar / editar valor / adiar / cancelar esse mês.
 * Editar valor pergunta se deve atualizar o valor_padrao da recorrência.
 */
import { useState } from "react";
import { toast } from "sonner";
import { X, Check, Pencil, Clock, Ban, Loader2, ArrowLeft } from "lucide-react";
import {
  confirmarOcorrencia,
  adiarOcorrencia,
  cancelarOcorrencia,
} from "@/hooks/useRecorrencias";
import { getErrorMessage } from "@/lib/api";
import type { OcorrenciaDetalhe } from "@/types/recorrencias";

type Modo = "menu" | "editar" | "editar_atualizar" | "adiar";

interface Props {
  ocorrencia: OcorrenciaDetalhe;
  onClose: () => void;
  onResolved: () => void;
}

function moeda(v: string | number): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    isNaN(n) ? 0 : n
  );
}

export function OcorrenciaDecisaoModal({ ocorrencia, onClose, onResolved }: Props) {
  const [modo, setModo] = useState<Modo>("menu");
  const [novoValor, setNovoValor] = useState(ocorrencia.valor_esperado);
  const [dias, setDias] = useState(3);
  const [processando, setProcessando] = useState(false);

  const finalizar = (msg: string) => {
    toast.success(msg);
    onResolved();
    onClose();
  };

  const erro = (e: unknown) => toast.error(getErrorMessage(e), { duration: 7000 });

  const confirmar = async (valor?: string, atualizar = false) => {
    if (processando) return;
    setProcessando(true);
    try {
      await confirmarOcorrencia(ocorrencia.id, valor, atualizar);
      finalizar("Confirmado! Lançamento criado.");
    } catch (e) {
      erro(e);
      setProcessando(false);
    }
  };

  const adiar = async () => {
    if (processando) return;
    setProcessando(true);
    try {
      await adiarOcorrencia(ocorrencia.id, dias);
      finalizar(`Adiado por ${dias} dia(s).`);
    } catch (e) {
      erro(e);
      setProcessando(false);
    }
  };

  const cancelar = async () => {
    if (processando) return;
    setProcessando(true);
    try {
      await cancelarOcorrencia(ocorrencia.id);
      finalizar("Ocorrência cancelada. A recorrência continua ativa.");
    } catch (e) {
      erro(e);
      setProcessando(false);
    }
  };

  const dataFmt = new Date(ocorrencia.data_esperada + "T00:00:00").toLocaleDateString("pt-BR");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">
            Chegou o dia: {ocorrencia.recorrencia_titulo}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-sm">
            <p className="text-zinc-400">
              Valor esperado:{" "}
              <span className="text-white font-semibold">{moeda(ocorrencia.valor_esperado)}</span>
            </p>
            <p className="text-zinc-400">
              Data esperada: <span className="text-white">{dataFmt}</span>
            </p>
          </div>

          {/* MENU: os 4 botões */}
          {modo === "menu" && (
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => confirmar()}
                disabled={processando}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirmar
              </button>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setModo("editar")}
                  disabled={processando}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-zinc-200 hover:bg-white/5 text-sm transition-colors disabled:opacity-60"
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar valor
                </button>
                <button
                  onClick={() => setModo("adiar")}
                  disabled={processando}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-zinc-200 hover:bg-white/5 text-sm transition-colors disabled:opacity-60"
                >
                  <Clock className="h-3.5 w-3.5" /> Adiar
                </button>
                <button
                  onClick={cancelar}
                  disabled={processando}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition-colors disabled:opacity-60"
                >
                  <Ban className="h-3.5 w-3.5" /> Cancelar mês
                </button>
              </div>
            </div>
          )}

          {/* EDITAR VALOR */}
          {modo === "editar" && (
            <div className="space-y-3">
              <label className="text-xs text-zinc-400 block">Novo valor</label>
              <input
                type="number"
                step="0.01"
                value={novoValor}
                onChange={(e) => setNovoValor(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setModo("menu")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-zinc-400 hover:text-white text-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <button
                  onClick={() => setModo("editar_atualizar")}
                  disabled={!novoValor || parseFloat(novoValor) <= 0}
                  className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* EDITAR VALOR → atualizar recorrência? */}
          {modo === "editar_atualizar" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-300">
                Deseja atualizar o valor da recorrência para{" "}
                <span className="text-white font-semibold">{moeda(novoValor)}</span> nos
                próximos meses?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => confirmar(novoValor, false)}
                  disabled={processando}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-zinc-200 hover:bg-white/5 text-sm disabled:opacity-60"
                >
                  Não, só esse mês
                </button>
                <button
                  onClick={() => confirmar(novoValor, true)}
                  disabled={processando}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-60"
                >
                  {processando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Sim, atualizar
                </button>
              </div>
            </div>
          )}

          {/* ADIAR */}
          {modo === "adiar" && (
            <div className="space-y-3">
              <label className="text-xs text-zinc-400 block">Adiar por quantos dias?</label>
              <input
                type="number"
                min={1}
                value={dias}
                onChange={(e) => setDias(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setModo("menu")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-zinc-400 hover:text-white text-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <button
                  onClick={adiar}
                  disabled={processando}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-60"
                >
                  {processando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Adiar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

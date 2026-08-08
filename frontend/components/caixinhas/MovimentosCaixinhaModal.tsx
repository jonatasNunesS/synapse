"use client";

/**
 * Synapse — Detalhe da caixinha: histórico de depósitos e retiradas.
 */

import { useEffect } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  Pencil,
  X,
} from "lucide-react";
import { useMovimentosCaixinha } from "@/hooks/useCaixinhas";
import type { Caixinha } from "@/types/caixinhas";
import { moedaCaixinha } from "./CaixinhaCard";

interface MovimentosCaixinhaModalProps {
  caixinha: Caixinha;
  onEditar: (caixinha: Caixinha) => void;
  onClose: () => void;
}

function dataHora(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function MovimentosCaixinhaModal({
  caixinha,
  onEditar,
  onClose,
}: MovimentosCaixinhaModalProps) {
  const { movimentos, loading, carregar } = useMovimentosCaixinha();

  useEffect(() => {
    carregar(caixinha.id);
  }, [carregar, caixinha.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {caixinha.icone} {caixinha.nome}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Saldo: <span className="text-white font-semibold">{moedaCaixinha(caixinha.saldo)}</span>
              {caixinha.meta && (
                <span className="ml-2">
                  · Meta: {moedaCaixinha(caixinha.meta)}
                  {caixinha.meta_atingida && " 🎉"}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEditar(caixinha)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Editar caixinha"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Carregando movimentos...
            </div>
          ) : movimentos.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              Nenhum movimento ainda. Faça o primeiro depósito!
            </p>
          ) : (
            <ul className="space-y-3">
              {movimentos.map((mov) => {
                const deposito = mov.tipo === "deposito";
                return (
                  <li
                    key={mov.id}
                    className="flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-xl p-3"
                  >
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        deposito
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-brand-500/10 text-brand-400"
                      }`}
                    >
                      {deposito ? (
                        <ArrowDownToLine className="w-4 h-4" />
                      ) : (
                        <ArrowUpFromLine className="w-4 h-4" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        {mov.tipo_display}
                        {mov.descricao && (
                          <span className="text-slate-400"> — {mov.descricao}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {dataHora(mov.criado_em)}
                        {mov.criado_por_nome && ` · ${mov.criado_por_nome}`}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold tabular-nums flex-shrink-0 ${
                        deposito ? "text-emerald-400" : "text-brand-300"
                      }`}
                    >
                      {deposito ? "+" : "−"}
                      {moedaCaixinha(mov.valor)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

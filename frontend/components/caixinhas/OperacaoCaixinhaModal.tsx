"use client";

/**
 * Synapse — Modal de depósito/retirada de caixinha.
 *
 * Retirada maior que o saldo NÃO passa: o modal oferece retirar o máximo
 * ("A caixinha só tem R$ X. Quer retirar R$ X?") ou cancelar. A validação
 * acontece localmente e também cobre o 400 SALDO_INSUFICIENTE do backend
 * (fonte da verdade em caso de corrida), que devolve details.saldo_atual.
 */

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, X } from "lucide-react";
import type { Caixinha } from "@/types/caixinhas";
import type { ApiError } from "@/types/api";
import { getErrorMessage } from "@/lib/api";
import { moedaCaixinha } from "./CaixinhaCard";

interface OperacaoCaixinhaModalProps {
  caixinha: Caixinha;
  tipo: "deposito" | "retirada";
  /** Saldo disponível da empresa (referência no depósito). */
  saldoDisponivel?: number | null;
  onConfirm: (valor: string, descricao: string) => Promise<void>;
  onClose: () => void;
}

export function OperacaoCaixinhaModal({
  caixinha,
  tipo,
  saldoDisponivel,
  onConfirm,
  onClose,
}: OperacaoCaixinhaModalProps) {
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Oferta de "retirar tudo" quando o valor excede o saldo da caixinha
  const [ofertaMaximo, setOfertaMaximo] = useState<string | null>(null);

  const isDeposito = tipo === "deposito";
  const saldoCaixinha = parseFloat(caixinha.saldo);
  const valorNum = parseFloat(valor.replace(",", "."));
  const valorValido = !isNaN(valorNum) && valorNum > 0;

  const executar = async (valorFinal: string) => {
    setProcessando(true);
    setErro(null);
    try {
      await onConfirm(valorFinal, descricao.trim());
    } catch (err: unknown) {
      const e = err as ApiError;
      // Corrida: o backend informa o saldo real — atualiza a oferta
      if (e?.error?.code === "SALDO_INSUFICIENTE" && e.error.details?.saldo_atual) {
        setOfertaMaximo(String(e.error.details.saldo_atual));
      } else {
        setErro(getErrorMessage(err));
      }
    } finally {
      setProcessando(false);
    }
  };

  const confirmar = async () => {
    if (!valorValido || processando) return;
    if (!isDeposito && valorNum > saldoCaixinha) {
      // Não deixa passar: oferece o máximo disponível
      setOfertaMaximo(caixinha.saldo);
      return;
    }
    await executar(valorNum.toFixed(2));
  };

  const inputClass =
    "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            {isDeposito ? (
              <ArrowDownToLine className="w-5 h-5 text-emerald-400" />
            ) : (
              <ArrowUpFromLine className="w-5 h-5 text-violet-400" />
            )}
            {isDeposito ? "Depositar em" : "Retirar de"} {caixinha.icone}{" "}
            {caixinha.nome}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Referência de saldo */}
          <p className="text-xs text-slate-400">
            {isDeposito ? (
              saldoDisponivel != null ? (
                <>Saldo disponível: <span className="text-white font-medium">{moedaCaixinha(saldoDisponivel)}</span></>
              ) : (
                <>O valor sai do seu saldo disponível.</>
              )
            ) : (
              <>Saldo da caixinha: <span className="text-white font-medium">{moedaCaixinha(caixinha.saldo)}</span></>
            )}
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Valor (R$) *
            </label>
            <input
              value={valor}
              onChange={(e) => {
                setValor(e.target.value);
                setOfertaMaximo(null);
              }}
              placeholder="0,00"
              inputMode="decimal"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Descrição (opcional)
            </label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={255}
              placeholder='Ex: "Reserva pro evento X"'
              className={inputClass}
            />
          </div>

          {/* Oferta de retirar o máximo */}
          {ofertaMaximo !== null && (
            <div
              role="alert"
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200 space-y-2"
            >
              <p>
                A caixinha só tem{" "}
                <span className="font-semibold text-amber-300">
                  {moedaCaixinha(ofertaMaximo)}
                </span>
                . Quer retirar {moedaCaixinha(ofertaMaximo)} (tudo que tem)?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => executar(parseFloat(ofertaMaximo).toFixed(2))}
                  disabled={processando}
                  className="flex-1 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-medium text-white transition-colors disabled:opacity-50"
                >
                  Retirar {moedaCaixinha(ofertaMaximo)}
                </button>
                <button
                  onClick={() => setOfertaMaximo(null)}
                  disabled={processando}
                  className="flex-1 py-1.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/5 transition-colors"
                >
                  Cancelar
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

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={processando}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!valorValido || processando || ofertaMaximo !== null}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDeposito
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-violet-600 hover:bg-violet-500"
            }`}
          >
            {processando && <Loader2 className="w-4 h-4 animate-spin" />}
            {isDeposito ? "Depositar" : "Retirar"}
            {valorValido ? ` ${moedaCaixinha(valorNum)}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

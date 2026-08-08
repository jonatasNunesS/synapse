"use client";
/**
 * Modal de cobrança de venda fiada (a "pergunta" do sino, mesmo padrão das
 * recorrências): confirmar pagamento / adiar / cancelar.
 *
 * Confirmar aceita valor diferente (parcial). Se o recebido for menor que o
 * original, oferece registrar o restante como nova interação pendente.
 */
import { useState } from "react";
import { toast } from "sonner";
import { X, Check, Clock, Ban, Loader2, ArrowLeft } from "lucide-react";
import { useInteracoes } from "@/hooks/useClientes";
import { getErrorMessage } from "@/lib/api";
import type { InteracaoCliente } from "@/types/clientes";

type Modo = "menu" | "confirmar" | "restante" | "adiar";

interface Props {
  clienteId: string;
  clienteNome: string;
  interacao: InteracaoCliente;
  onClose: () => void;
  onResolved: () => void;
}

function moeda(v: string | number): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    isNaN(n) ? 0 : n
  );
}

export function FiadoDecisaoModal({
  clienteId,
  clienteNome,
  interacao,
  onClose,
  onResolved,
}: Props) {
  const { confirmarPagamento, adiarPagamento, cancelarPagamento } = useInteracoes(clienteId);
  const [modo, setModo] = useState<Modo>("menu");
  const valorOriginal = interacao.valor ?? "0";
  const [valorRecebido, setValorRecebido] = useState(valorOriginal);
  const [dataRestante, setDataRestante] = useState("");
  const [dias, setDias] = useState(7);
  const [processando, setProcessando] = useState(false);

  const restante = parseFloat(valorOriginal) - parseFloat(valorRecebido || "0");

  const erro = (e: unknown) => {
    toast.error(getErrorMessage(e), { duration: 7000 });
    setProcessando(false);
  };

  const finalizar = (msg: string) => {
    toast.success(msg);
    onResolved();
    onClose();
  };

  // Confirma o pagamento (opcionalmente criando o saldo devedor)
  const efetivarConfirmacao = async (criarRestante: boolean) => {
    if (processando) return;
    setProcessando(true);
    try {
      const mudou = parseFloat(valorRecebido) !== parseFloat(valorOriginal);
      await confirmarPagamento(interacao.id, {
        valor_confirmado: mudou ? valorRecebido : undefined,
        criar_restante: criarRestante,
        data_prevista_restante: criarRestante ? dataRestante || undefined : undefined,
      });
      finalizar(`Pagamento de ${moeda(valorRecebido)} confirmado!`);
    } catch (e) {
      erro(e);
    }
  };

  const aoConfirmar = () => {
    // Recebido menor que o combinado → oferece registrar o restante
    if (restante > 0) {
      setModo("restante");
      return;
    }
    efetivarConfirmacao(false);
  };

  const adiar = async () => {
    if (processando) return;
    setProcessando(true);
    try {
      await adiarPagamento(interacao.id, dias);
      finalizar(`Cobrança adiada por ${dias} dia(s).`);
    } catch (e) {
      erro(e);
    }
  };

  const cancelar = async () => {
    if (processando) return;
    setProcessando(true);
    try {
      await cancelarPagamento(interacao.id);
      finalizar("Essa venda não será cobrada.");
    } catch (e) {
      erro(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">
            {clienteNome} ficou de pagar {moeda(valorOriginal)} hoje
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-sm">
            <p className="text-zinc-400">
              Referente a: <span className="text-white">{interacao.titulo}</span>
            </p>
          </div>

          {/* MENU */}
          {modo === "menu" && (
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setModo("confirmar")}
                disabled={processando}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                <Check className="h-4 w-4" /> Confirmar pagamento
              </button>
              <div className="grid grid-cols-2 gap-2">
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
                  {processando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* CONFIRMAR: valor recebido (pode ser parcial/diferente) */}
          {modo === "confirmar" && (
            <div className="space-y-3">
              <label className="text-xs text-zinc-400 block">Valor recebido</label>
              <input
                type="number"
                step="0.01"
                value={valorRecebido}
                onChange={(e) => setValorRecebido(e.target.value)}
                aria-label="Valor recebido"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setModo("menu")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-zinc-400 hover:text-white text-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <button
                  onClick={aoConfirmar}
                  disabled={processando || !(parseFloat(valorRecebido) > 0)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {processando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar
                </button>
              </div>
            </div>
          )}

          {/* RESTANTE: recebido parcial → registrar o saldo devedor? */}
          {modo === "restante" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-300">
                Faltou <span className="text-white font-semibold">{moeda(restante)}</span>.
                Quer registrar o restante como nova interação pendente?
              </p>
              <label className="text-xs text-zinc-400 block">
                Previsão de pagamento do restante
              </label>
              <input
                type="date"
                value={dataRestante}
                onChange={(e) => setDataRestante(e.target.value)}
                aria-label="Previsão do restante"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => efetivarConfirmacao(false)}
                  disabled={processando}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-zinc-200 hover:bg-white/5 text-sm disabled:opacity-60"
                >
                  Não, só confirmar
                </button>
                <button
                  onClick={() => efetivarConfirmacao(true)}
                  disabled={processando || !dataRestante}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {processando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Sim, criar pendência
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
                aria-label="Dias para adiar"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
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
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium disabled:opacity-60"
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

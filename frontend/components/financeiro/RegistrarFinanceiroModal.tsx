"use client";
/**
 * Modal genérico "Deseja registrar no financeiro?" — reutilizado por compra
 * (despesa) e venda (receita). Não duplica: se já houver lançamento vinculado,
 * mostra o aviso em vez de oferecer de novo.
 */
import { useState } from "react";
import { X, Loader2, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";

interface RegistrarFinanceiroModalProps {
  tipo: "despesa" | "receita";
  valor: string;
  contraparteLabel: string; // "Fornecedor" | "Cliente"
  contraparteNome: string;
  jaRegistrado?: boolean;
  /** Faz a chamada ao backend (POST registrar-financeiro). */
  registrar: () => Promise<unknown>;
  onClose: () => void;
  onSuccess?: () => void;
}

function moeda(v: string): string {
  const n = parseFloat(v);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    isNaN(n) ? 0 : n
  );
}

export function RegistrarFinanceiroModal({
  tipo,
  valor,
  contraparteLabel,
  contraparteNome,
  jaRegistrado,
  registrar,
  onClose,
  onSuccess,
}: RegistrarFinanceiroModalProps) {
  const [processando, setProcessando] = useState(false);
  const ehDespesa = tipo === "despesa";

  const handleConfirmar = async () => {
    if (processando) return;
    setProcessando(true);
    try {
      await registrar();
      toast.success(
        ehDespesa ? "Despesa registrada no financeiro." : "Receita registrada no financeiro."
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      // Erro NUNCA calado: mostra a mensagem real do backend
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setProcessando(false);
    }
  };

  const cor = ehDespesa ? "text-erro" : "text-sucesso";
  const btn = ehDespesa
    ? "bg-red-600 hover:bg-red-500"
    : "bg-emerald-600 hover:bg-emerald-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            {ehDespesa ? (
              <TrendingDown className={`h-5 w-5 ${cor}`} />
            ) : (
              <TrendingUp className={`h-5 w-5 ${cor}`} />
            )}
            <h3 className="text-base font-semibold text-foreground">Registrar no financeiro</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-superficie-forte hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {jaRegistrado ? (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sucesso" />
              <p className="text-sm text-sucesso">
                {ehDespesa
                  ? "Esta compra já tem lançamento financeiro."
                  : "Esta venda já tem lançamento financeiro."}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-foreground-suave">Deseja registrar no financeiro?</p>
              <div className="mt-3 rounded-lg border border-border bg-white/[0.03] px-4 py-3">
                <p className="text-sm text-foreground">
                  {ehDespesa ? "Despesa" : "Receita"}:{" "}
                  <span className={`font-semibold ${cor}`}>{moeda(valor)}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-suave">
                  {contraparteLabel}: {contraparteNome}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          {jaRegistrado ? (
            <button
              onClick={onClose}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={processando}
                className="rounded-lg px-4 py-2 text-sm text-foreground-suave hover:bg-superficie disabled:opacity-50"
              >
                Não agora
              </button>
              <button
                onClick={handleConfirmar}
                disabled={processando}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-foreground disabled:opacity-60 ${btn}`}
              >
                {processando && <Loader2 className="h-4 w-4 animate-spin" />}
                {ehDespesa ? "Sim, registrar despesa" : "Sim, registrar receita"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";
/**
 * Synapse — a cobrança de uma venda fiada.
 *
 * As três respostas do fluxo antigo, na mesma ordem e com as mesmas palavras:
 * confirmar o recebimento, adiar, ou parar de cobrar. Nada aqui é novo — o que
 * é novo é a Venda ter chegado a ter fiado.
 *
 * Confirmar aceita valor menor que o saldo. Nesse caso a venda NÃO vira paga:
 * ela continua pendente pelo resto, com a nova previsão, e volta a cobrar
 * naquele dia. O saldo não vira uma segunda venda — seria a mesma mercadoria
 * contada duas vezes no faturamento.
 */
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Ban, Check, Clock, Loader2, X } from "lucide-react";

import { getErrorMessage } from "@/lib/api";
import { vendaFiado } from "@/hooks/useVendas";
import { formatCurrency } from "@/lib/utils";
import type { Venda } from "@/types/vendas";

type Modo = "menu" | "confirmar" | "saldo" | "adiar";

interface Props {
  venda: Venda;
  onClose: () => void;
  /** Recebe a venda como o backend a devolveu depois da ação. */
  onResolvida: (venda: Venda) => void;
}

export function VendaFiadoModal({ venda, onClose, onResolvida }: Props) {
  const saldo = venda.saldo_devedor;
  const [modo, setModo] = useState<Modo>("menu");
  const [valorRecebido, setValorRecebido] = useState(saldo);
  const [dataSaldo, setDataSaldo] = useState("");
  const [dias, setDias] = useState(7);
  const [processando, setProcessando] = useState(false);

  const restante = parseFloat(saldo) - parseFloat(valorRecebido || "0");
  const quem = venda.cliente_nome ?? (venda.devedor || "").trim();

  const falhou = (erro: unknown) => {
    // Erro nunca calado: "o saldo devedor é de R$ X" é acionável.
    toast.error(getErrorMessage(erro), { duration: 7000 });
    setProcessando(false);
  };

  const confirmar = async (comSaldo: boolean) => {
    if (processando) return;
    setProcessando(true);
    try {
      const parcial = parseFloat(valorRecebido) < parseFloat(saldo);
      const resultado = await vendaFiado.confirmar(venda.id, {
        valor_recebido: parcial ? valorRecebido : undefined,
        data_prevista_saldo: comSaldo ? dataSaldo || undefined : undefined,
      });
      toast.success(
        resultado.quitou
          ? `Pagamento de ${formatCurrency(resultado.recebido)} confirmado!`
          : `Recebido ${formatCurrency(resultado.recebido)}. Falta ${formatCurrency(
              resultado.saldo_devedor
            )}.`
      );
      onResolvida(resultado.venda);
      onClose();
    } catch (erro) {
      falhou(erro);
    }
  };

  const aoConfirmar = () => {
    // Recebeu menos que o saldo → pergunta quando cobrar o resto.
    if (restante > 0) {
      setModo("saldo");
      return;
    }
    confirmar(false);
  };

  const adiar = async () => {
    if (processando) return;
    setProcessando(true);
    try {
      onResolvida(await vendaFiado.adiar(venda.id, dias));
      toast.success(`Cobrança adiada por ${dias} dia(s).`);
      onClose();
    } catch (erro) {
      falhou(erro);
    }
  };

  const cancelar = async () => {
    if (processando) return;
    setProcessando(true);
    try {
      onResolvida(await vendaFiado.cancelar(venda.id));
      toast.success("Essa venda não será cobrada.");
      onClose();
    } catch (erro) {
      falhou(erro);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        data-testid="venda-fiado"
        className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">
            {quem
              ? `${quem} ficou de pagar ${formatCurrency(saldo)}`
              : `Venda fiada de ${formatCurrency(saldo)}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-border bg-superficie p-3 text-sm">
            <p className="text-muted-foreground">
              Venda de{" "}
              <span className="text-foreground">
                {new Date(venda.data_venda + "T00:00:00").toLocaleDateString("pt-BR")}
              </span>
              , total {formatCurrency(venda.total)}.
            </p>
            {parseFloat(venda.valor_recebido) > 0 && (
              <p className="mt-1 text-xs text-muted-suave">
                Já recebeu {formatCurrency(venda.valor_recebido)}.
              </p>
            )}
          </div>

          {modo === "menu" && (
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setModo("confirmar")}
                disabled={processando}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
              >
                <Check className="h-4 w-4" /> Confirmar pagamento
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModo("adiar")}
                  disabled={processando}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground-suave transition-colors hover:bg-superficie disabled:opacity-60"
                >
                  <Clock className="h-3.5 w-3.5" /> Adiar
                </button>
                <button
                  type="button"
                  onClick={cancelar}
                  disabled={processando}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-sm text-erro transition-colors hover:bg-red-500/10 disabled:opacity-60"
                >
                  {processando ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Ban className="h-3.5 w-3.5" />
                  )}
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {modo === "confirmar" && (
            <div className="space-y-3">
              <label
                htmlFor="fiado-valor"
                className="block text-xs text-muted-foreground"
              >
                Valor recebido
              </label>
              <input
                id="fiado-valor"
                type="number"
                step="0.01"
                min="0"
                value={valorRecebido}
                onChange={(e) => setValorRecebido(e.target.value)}
                aria-label="Valor recebido"
                className="w-full rounded-lg border border-border bg-superficie px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModo("menu")}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <button
                  type="button"
                  onClick={aoConfirmar}
                  disabled={processando || !(parseFloat(valorRecebido) > 0)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                >
                  {processando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar
                </button>
              </div>
            </div>
          )}

          {modo === "saldo" && (
            <div className="space-y-3" data-testid="fiado-saldo">
              <p className="text-sm text-foreground-suave">
                Faltam{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(restante)}
                </span>
                . Quando cobrar o resto?
              </p>
              <label
                htmlFor="fiado-data-saldo"
                className="block text-xs text-muted-foreground"
              >
                Nova previsão de pagamento
              </label>
              <input
                id="fiado-data-saldo"
                type="date"
                value={dataSaldo}
                onChange={(e) => setDataSaldo(e.target.value)}
                aria-label="Nova previsão"
                className="w-full rounded-lg border border-border bg-superficie px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => confirmar(false)}
                  disabled={processando}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-foreground-suave transition-colors hover:bg-superficie disabled:opacity-60"
                >
                  Manter a data atual
                </button>
                <button
                  type="button"
                  onClick={() => confirmar(true)}
                  disabled={processando || !dataSaldo}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
                >
                  {processando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cobrar nesta data
                </button>
              </div>
            </div>
          )}

          {modo === "adiar" && (
            <div className="space-y-3">
              <label
                htmlFor="fiado-dias"
                className="block text-xs text-muted-foreground"
              >
                Adiar por quantos dias?
              </label>
              <input
                id="fiado-dias"
                type="number"
                min={1}
                value={dias}
                onChange={(e) => setDias(Math.max(1, parseInt(e.target.value) || 1))}
                aria-label="Dias para adiar"
                className="w-full rounded-lg border border-border bg-superficie px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModo("menu")}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <button
                  type="button"
                  onClick={adiar}
                  disabled={processando}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-60"
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

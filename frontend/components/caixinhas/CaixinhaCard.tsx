"use client";

/**
 * Synapse — Card de caixinha.
 * Nome + ícone + cor, saldo atual, barra de progresso quando há meta,
 * badge "Meta atingida! 🎉" ao chegar em 100%, e ações de depositar/retirar.
 * Clicar no corpo do card abre o detalhe com o histórico de movimentos.
 */

import { ArrowDownToLine, ArrowUpFromLine, PiggyBank } from "lucide-react";
import type { Caixinha } from "@/types/caixinhas";

export function moedaCaixinha(v: string | number): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n || 0);
}

interface CaixinhaCardProps {
  caixinha: Caixinha;
  onDepositar: (caixinha: Caixinha) => void;
  onRetirar: (caixinha: Caixinha) => void;
  onAbrir: (caixinha: Caixinha) => void;
}

export function CaixinhaCard({
  caixinha,
  onDepositar,
  onRetirar,
  onAbrir,
}: CaixinhaCardProps) {
  const temMeta = caixinha.meta !== null && caixinha.progresso !== null;
  const saldoZero = parseFloat(caixinha.saldo) <= 0;

  return (
    <div
      className="rounded-xl border border-border bg-white/[0.03] p-5 hover:border-border transition-colors flex flex-col gap-3"
      style={{ borderTopColor: caixinha.cor, borderTopWidth: 3 }}
    >
      {/* Corpo clicável: abre detalhe/histórico */}
      <button
        onClick={() => onAbrir(caixinha)}
        className="text-left flex-1 space-y-3"
        title="Ver histórico de movimentos"
      >
        <div className="flex items-center gap-2">
          <span
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
            style={{ backgroundColor: `${caixinha.cor}22` }}
          >
            {caixinha.icone || <PiggyBank className="w-4 h-4" style={{ color: caixinha.cor }} />}
          </span>
          <h3 className="text-sm font-semibold text-foreground truncate">
            {caixinha.nome}
          </h3>
        </div>

        <p className="text-2xl font-bold text-foreground tabular-nums">
          {moedaCaixinha(caixinha.saldo)}
        </p>

        {temMeta && (
          <div className="space-y-1.5">
            <div
              className="h-2 rounded-full bg-superficie-forte overflow-hidden"
              role="progressbar"
              aria-valuenow={caixinha.progresso ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${caixinha.progresso}%`,
                  backgroundColor: caixinha.cor,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Meta: {moedaCaixinha(caixinha.meta!)}
              </span>
              {caixinha.meta_atingida ? (
                <span className="text-sucesso font-medium">
                  Meta atingida! 🎉
                </span>
              ) : (
                <span className="text-muted-foreground tabular-nums">
                  {caixinha.progresso}%
                </span>
              )}
            </div>
          </div>
        )}
      </button>

      {/* Ações */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={() => onDepositar(caixinha)}
          className="inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600/15 border border-emerald-500/25 text-xs font-medium text-sucesso hover:bg-emerald-600/25 transition-colors"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Depositar
        </button>
        <button
          onClick={() => onRetirar(caixinha)}
          disabled={saldoZero}
          className="inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-superficie border border-border text-xs font-medium text-foreground-suave hover:bg-superficie-forte transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={saldoZero ? "A caixinha está vazia" : "Retirar da caixinha"}
        >
          <ArrowUpFromLine className="w-3.5 h-3.5" />
          Retirar
        </button>
      </div>
    </div>
  );
}

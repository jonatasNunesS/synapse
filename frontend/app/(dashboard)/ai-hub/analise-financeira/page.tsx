"use client";
/**
 * AI Hub 2.0 — Análise Financeira.
 * Botão → Celery + polling → resultado estruturado (diagnóstico / números-chave
 * / recomendações). Estado claro quando não há dados. Tema dark via tokens.
 */
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  LineChart,
  Loader2,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  FileText,
} from "lucide-react";
import { useEffect } from "react";
import { useAnaliseFinanceira } from "@/hooks/useAnaliseFinanceira";
import { getErrorMessage } from "@/lib/api";
import { CreditosBadge } from "@/components/ai_hub/CreditosBadge";
import { recarregarCreditos } from "@/hooks/useCreditos";
import { CUSTO_OPERACAO } from "@/types/creditos";
import type { NumeroChave } from "@/types/analise_financeira";

function corVariacao(v: string | null): string {
  if (!v) return "text-muted-foreground";
  if (v.startsWith("+")) return "text-emerald-400";
  if (v.startsWith("-")) return "text-red-400";
  return "text-muted-foreground";
}

function CardNumero({ n }: { n: NumeroChave }) {
  const positivo = n.variacao?.startsWith("+");
  const negativo = n.variacao?.startsWith("-");
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground mb-1">{n.label}</p>
      <p className="text-lg font-semibold text-foreground">{n.valor}</p>
      {n.variacao && (
        <p className={`text-xs mt-0.5 flex items-center gap-1 ${corVariacao(n.variacao)}`}>
          {positivo && <TrendingUp className="h-3 w-3" />}
          {negativo && <TrendingDown className="h-3 w-3" />}
          {n.variacao}
        </p>
      )}
    </div>
  );
}

export default function AnaliseFinanceiraPage() {
  const { estado, analise, mensagem, analisar } = useAnaliseFinanceira();

  // Refresca o saldo de créditos ao concluir ou falhar (reserva/devolução)
  useEffect(() => {
    if (estado === "concluido" || estado === "erro") recarregarCreditos();
  }, [estado]);

  const handleAnalisar = async () => {
    try {
      await analisar();
      recarregarCreditos(); // reserva já debitou → atualiza o badge na hora
    } catch (err) {
      // 402 SEM_CREDITOS cai aqui com mensagem clara + CTA de upgrade
      toast.error(getErrorMessage(err), { duration: 7000 });
    }
  };

  const processando = estado === "processando";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/ai-hub"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          AI Hub
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <LineChart className="h-6 w-6 text-primary" />
              Análise Financeira
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              A IA analisa os números reais do seu mês e devolve diagnóstico e recomendações.
            </p>
          </div>
          <CreditosBadge />
        </div>
      </div>

      {/* Ação */}
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center text-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <LineChart className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          Usamos apenas os seus dados financeiros reais do período. Nenhum número é inventado.
        </p>
        <button
          onClick={handleAnalisar}
          disabled={processando}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {processando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando seu financeiro…
            </>
          ) : (
            <>
              <LineChart className="h-4 w-4" />
              {analise ? "Analisar novamente" : "Analisar meu financeiro"}
              <span className="opacity-80">({CUSTO_OPERACAO.analise_financeira} créditos)</span>
            </>
          )}
        </button>
        {processando && (
          <p className="text-xs text-muted-foreground">
            Isso leva alguns segundos — a IA está processando os números.
          </p>
        )}
      </div>

      {/* Estado: sem dados */}
      {estado === "sem_dados" && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-foreground font-medium mb-1">Sem dados suficientes</p>
          <p className="text-sm text-muted-foreground mb-4">{mensagem}</p>
          <Link
            href="/financeiro"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Ir para o Financeiro
          </Link>
        </div>
      )}

      {/* Resultado */}
      {estado === "concluido" && analise && (
        <div className="space-y-5">
          <p className="text-xs text-muted-foreground">
            Período: <span className="text-foreground">{analise.periodo.label}</span>{" "}
            (comparado a {analise.periodo.label_anterior})
          </p>

          {/* Números-chave */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-2">Números-chave</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {analise.numeros_chave.map((n) => (
                <CardNumero key={n.label} n={n} />
              ))}
            </div>
          </div>

          {/* Diagnóstico */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Diagnóstico
            </h2>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {analise.diagnostico}
            </p>
          </div>

          {/* Recomendações */}
          {analise.recomendacoes.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                Recomendações
              </h2>
              <ul className="space-y-2.5">
                {analise.recomendacoes.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/90">
                    <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Gerado por IA ({analise.modelo}) a partir dos seus dados. Use como apoio à decisão,
            não como aconselhamento financeiro definitivo.
          </p>
        </div>
      )}
    </div>
  );
}

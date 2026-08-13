"use client";
/**
 * AI Hub 2.0 — Análise Financeira (comparação seletiva de dois meses).
 * O usuário escolhe o mês principal e um mês de comparação (ambos entre os
 * meses que têm dados). A IA compara os dois períodos. Celery + polling.
 * Tema dark via tokens.
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
import { useEffect, useMemo, useState } from "react";
import {
  useAnaliseFinanceira,
  useMesesComDados,
} from "@/hooks/useAnaliseFinanceira";
import { getErrorMessage } from "@/lib/api";
import { CreditosBadge } from "@/components/ai_hub/CreditosBadge";
import { recarregarCreditos } from "@/hooks/useCreditos";
import { CUSTO_OPERACAO } from "@/types/creditos";
import type { NumeroChave, PeriodoSelecao } from "@/types/analise_financeira";

function corVariacao(v: string | null): string {
  if (!v) return "text-muted-foreground";
  if (v.startsWith("+")) return "text-sucesso";
  if (v.startsWith("-")) return "text-erro";
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

const chave = (p: PeriodoSelecao) => `${p.ano}-${p.mes}`;

export default function AnaliseFinanceiraPage() {
  const { estado, analise, mensagem, analisar } = useAnaliseFinanceira();
  const { meses } = useMesesComDados();

  const [principal, setPrincipal] = useState<PeriodoSelecao | null>(null);
  const [comparacao, setComparacao] = useState<PeriodoSelecao | null>(null);

  // Ao carregar os meses: principal = mais recente; comparação = o seguinte.
  useEffect(() => {
    if (meses.length === 0) return;
    setPrincipal((p) => p ?? { mes: meses[0].mes, ano: meses[0].ano });
    setComparacao((c) =>
      c ?? (meses[1] ? { mes: meses[1].mes, ano: meses[1].ano } : null)
    );
  }, [meses]);

  // Refresca o saldo de créditos ao concluir ou falhar (reserva/devolução)
  useEffect(() => {
    if (estado === "concluido" || estado === "erro") recarregarCreditos();
  }, [estado]);

  const mesmoPeriodo = Boolean(
    principal && comparacao && chave(principal) === chave(comparacao)
  );

  const handleAnalisar = async () => {
    if (mesmoPeriodo) {
      toast.error("Escolha dois meses diferentes para comparar.");
      return;
    }
    try {
      await analisar(principal, comparacao);
      recarregarCreditos(); // reserva já debitou → atualiza o badge na hora
    } catch (err) {
      // 402 SEM_CREDITOS / 400 COMPARACAO_SEM_DADOS caem aqui com msg clara
      toast.error(getErrorMessage(err), { duration: 7000 });
    }
  };

  const processando = estado === "processando";

  const opcoes = useMemo(
    () =>
      meses.map((m) => ({
        value: `${m.ano}-${m.mes}`,
        label: m.label,
        mes: m.mes,
        ano: m.ano,
      })),
    [meses]
  );

  const onSelect = (
    valor: string,
    setter: (p: PeriodoSelecao | null) => void
  ) => {
    const o = opcoes.find((x) => x.value === valor);
    setter(o ? { mes: o.mes, ano: o.ano } : null);
  };

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
              <LineChart className="h-6 w-6 text-brand-accent" />
              Análise Financeira
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Escolha dois meses e a IA compara os números reais — o que
              melhorou e o que piorou entre eles.
            </p>
          </div>
          <CreditosBadge />
        </div>
      </div>

      {/* Ação + seletores de período */}
      <div className="rounded-xl border border-border bg-card shadow-elevacao p-6 flex flex-col items-center text-center gap-4">
        {meses.length === 0 ? (
          <p className="text-sm text-muted-foreground max-w-md">
            Ainda não há meses com lançamentos. Cadastre receitas e despesas no
            Financeiro para poder analisar.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
            <div className="flex flex-col items-start gap-1">
              <label className="text-xs text-muted-foreground">Mês principal</label>
              <select
                value={principal ? chave(principal) : ""}
                onChange={(e) => onSelect(e.target.value, setPrincipal)}
                disabled={processando}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
              >
                {opcoes.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-muted-foreground text-sm mt-5 hidden sm:block">
              comparado com
            </span>
            <div className="flex flex-col items-start gap-1">
              <label className="text-xs text-muted-foreground">Mês de comparação</label>
              <select
                value={comparacao ? chave(comparacao) : ""}
                onChange={(e) => onSelect(e.target.value, setComparacao)}
                disabled={processando}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
              >
                {opcoes.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground max-w-md">
          Usamos apenas os seus dados financeiros reais dos períodos. Nenhum
          número é inventado.
        </p>
        <button
          onClick={handleAnalisar}
          disabled={processando || meses.length === 0 || mesmoPeriodo}
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
              {analise ? "Analisar novamente" : "Comparar períodos"}
              <span className="opacity-80">({CUSTO_OPERACAO.analise_financeira} créditos)</span>
            </>
          )}
        </button>
        {mesmoPeriodo && (
          <p className="text-xs text-erro">
            Escolha dois meses diferentes para comparar.
          </p>
        )}
        {processando && (
          <p className="text-xs text-muted-foreground">
            Isso leva alguns segundos — a IA está processando os números.
          </p>
        )}
      </div>

      {/* Estado: sem dados */}
      {estado === "sem_dados" && (
        <div className="rounded-xl border border-border bg-card shadow-elevacao p-6 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-foreground font-medium mb-1">Sem dados suficientes</p>
          <p className="text-sm text-muted-foreground mb-4">{mensagem}</p>
          <Link
            href="/financeiro"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-accent hover:underline"
          >
            Ir para o Financeiro
          </Link>
        </div>
      )}

      {/* Resultado */}
      {estado === "concluido" && analise && (
        <div className="space-y-5">
          <p className="text-xs text-muted-foreground">
            Comparando{" "}
            <span className="text-foreground">{analise.periodo.label}</span> com{" "}
            <span className="text-foreground">
              {analise.comparacao?.label ?? analise.periodo.label_anterior}
            </span>
          </p>

          {/* Números-chave dos dois períodos, lado a lado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">
                {analise.periodo.label}{" "}
                <span className="text-xs font-normal text-muted-foreground">(principal)</span>
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {analise.numeros_chave.map((n) => (
                  <CardNumero key={n.label} n={n} />
                ))}
              </div>
            </div>
            {analise.numeros_chave_comparacao &&
              analise.numeros_chave_comparacao.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-foreground mb-2">
                    {analise.comparacao?.label ?? analise.periodo.label_anterior}{" "}
                    <span className="text-xs font-normal text-muted-foreground">(comparação)</span>
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {analise.numeros_chave_comparacao.map((n) => (
                      <CardNumero key={n.label} n={n} />
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* Diagnóstico */}
          <div className="rounded-xl border border-border bg-card shadow-elevacao p-5">
            <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-accent" />
              Diagnóstico comparativo
            </h2>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {analise.diagnostico}
            </p>
          </div>

          {/* Recomendações */}
          {analise.recomendacoes.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-brand-accent" />
                Recomendações
              </h2>
              <ul className="space-y-2.5">
                {analise.recomendacoes.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/90">
                    <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/15 text-brand-accent text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[0.6875rem] text-muted-foreground">
            Gerado por IA ({analise.modelo}) a partir dos seus dados. Use como apoio à decisão,
            não como aconselhamento financeiro definitivo.
          </p>
        </div>
      )}
    </div>
  );
}

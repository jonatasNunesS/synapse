"use client";
/**
 * AI Hub — Chat Financeiro.
 * Consultor conversacional RESTRITO ao financeiro do próprio negócio. Cada
 * pergunta custa 2 créditos. Celery + polling (mesmo padrão da Análise).
 * Histórico vive só na sessão (não persiste). Tema dark via tokens.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  MessageSquare,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Info,
} from "lucide-react";
import { useChatFinanceiro } from "@/hooks/useChatFinanceiro";
import { useCreditos } from "@/hooks/useCreditos";
import { CreditosBadge } from "@/components/ai_hub/CreditosBadge";
import { CUSTO_OPERACAO } from "@/types/creditos";

const CUSTO = CUSTO_OPERACAO.chat_financeiro;

const SUGESTOES = [
  "Por que meu saldo caiu esse mês?",
  "Quanto tenho a receber?",
  "E se eu não cobrar os atrasados?",
  "Onde estão meus maiores custos?",
];

export default function ChatFinanceiroPage() {
  const { mensagens, enviando, perguntar, limpar } = useChatFinanceiro();
  const { creditos } = useCreditos();
  const [texto, setTexto] = useState("");
  const fimRef = useRef<HTMLDivElement | null>(null);

  const semCreditos =
    creditos != null &&
    !creditos.ilimitado &&
    (creditos.restante ?? 0) < CUSTO;

  // Rola para a última mensagem quando a conversa cresce ou processa.
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, enviando]);

  const enviar = async (pergunta: string) => {
    const limpo = pergunta.trim();
    if (!limpo || enviando) return;
    if (semCreditos) {
      toast.error(
        `Sem créditos suficientes hoje (cada pergunta custa ${CUSTO}). Renova à 00:00 ou faça upgrade.`,
        { duration: 7000 }
      );
      return;
    }
    setTexto("");
    try {
      await perguntar(limpo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar.", {
        duration: 7000,
      });
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    enviar(texto);
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
              <MessageSquare className="h-6 w-6 text-primary" />
              Chat Financeiro
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pergunte sobre os números reais do seu negócio. O assistente usa
              só os seus dados — e responde apenas sobre o seu financeiro.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CreditosBadge />
            {mensagens.length > 0 && (
              <button
                onClick={limpar}
                disabled={enviando}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                title="Limpar conversa"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Janela da conversa */}
      <div className="rounded-xl border border-border bg-card flex flex-col min-h-[420px]">
        <div className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto">
          {mensagens.length === 0 && !enviando && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-10">
              <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground max-w-sm">
                Faça uma pergunta sobre o seu financeiro. Sugestões:
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    disabled={semCreditos}
                    className="text-xs px-3 py-1.5 rounded-full border border-border text-foreground hover:border-primary/50 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensagens.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-background border border-border text-foreground rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {enviando && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 bg-background border border-border text-muted-foreground text-sm inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Consultando os seus números…
              </div>
            </div>
          )}
          <div ref={fimRef} />
        </div>

        {/* Estado: sem créditos */}
        {semCreditos && (
          <div className="border-t border-border px-4 py-2.5 text-xs text-destructive bg-destructive/5 flex items-center gap-2">
            <Info className="h-3.5 w-3.5 flex-shrink-0" />
            Sem créditos suficientes hoje (cada pergunta custa {CUSTO}). Renova à
            00:00 ou faça upgrade do plano.
          </div>
        )}

        {/* Campo de pergunta */}
        <form
          onSubmit={onSubmit}
          className="border-t border-border p-3 flex items-end gap-2"
        >
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(texto);
              }
            }}
            rows={1}
            placeholder="Pergunte sobre o seu financeiro…"
            disabled={enviando || semCreditos}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 max-h-32"
          />
          <button
            type="submit"
            disabled={enviando || semCreditos || !texto.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
            <span className="opacity-80">({CUSTO} créditos)</span>
          </button>
        </form>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Respostas geradas por IA (llama-3.3-70b) a partir dos seus dados reais.
        Use como apoio à decisão, não como aconselhamento financeiro definitivo.
        A conversa não é salva — some ao sair.
      </p>
    </div>
  );
}

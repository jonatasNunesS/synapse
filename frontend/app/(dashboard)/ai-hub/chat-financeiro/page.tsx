"use client";
/**
 * AI Hub — Chat Financeiro.
 * Consultor conversacional RESTRITO ao financeiro do próprio negócio. Cada
 * pergunta custa 2 créditos. Celery + polling (mesmo padrão da Análise).
 *
 * Histórico das conversas fica no localStorage do navegador (isolado por
 * usuário + empresa) — NÃO persiste no banco. Painel lateral lista conversas
 * anteriores; some se o usuário limpar os dados do navegador. Tema dark.
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
  Plus,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { useChatFinanceiro } from "@/hooks/useChatFinanceiro";
import { useChatHistory } from "@/hooks/useChatHistory";
import { useCreditos } from "@/hooks/useCreditos";
import { useAuth } from "@/hooks/useAuth";
import { CreditosBadge } from "@/components/ai_hub/CreditosBadge";
import { UpgradeWhatsappButton } from "@/components/ui/UpgradeWhatsappButton";
import { useUpgradeWhatsappUrl } from "@/hooks/useUpgradeWhatsapp";
import { CUSTO_OPERACAO } from "@/types/creditos";

const CUSTO = CUSTO_OPERACAO.chat_financeiro;

const SUGESTOES = [
  "Por que meu saldo caiu esse mês?",
  "Quanto tenho a receber?",
  "E se eu não cobrar os atrasados?",
  "Onde estão meus maiores custos?",
];

export default function ChatFinanceiroPage() {
  const { mensagens, enviando, perguntar, limpar, carregar } = useChatFinanceiro();
  const { creditos } = useCreditos();
  const { usuario, empresa } = useAuth();
  const upgradeUrl = useUpgradeWhatsappUrl();
  const { conversas, salvar, excluir, renomear } = useChatHistory(
    usuario?.id,
    empresa?.id ?? usuario?.empresa?.id ?? null
  );

  const [texto, setTexto] = useState("");
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [tituloEdit, setTituloEdit] = useState("");
  const fimRef = useRef<HTMLDivElement | null>(null);

  const semCreditos =
    creditos != null &&
    !creditos.ilimitado &&
    (creditos.restante ?? 0) < CUSTO;

  // Rola para a última mensagem.
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, enviando]);

  // Salva a conversa no localStorage a cada turno completo (última = assistente).
  const turnoCompleto =
    mensagens.length > 0 && mensagens[mensagens.length - 1].role === "assistant";
  useEffect(() => {
    if (!turnoCompleto) return;
    setConversaId((prev) => salvar(prev, mensagens) ?? prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnoCompleto, mensagens]);

  const novaConversa = () => {
    limpar();
    setConversaId(null);
    setTexto("");
  };

  const abrirConversa = (id: string) => {
    const c = conversas.find((x) => x.id === id);
    if (!c) return;
    carregar(c.mensagens);
    setConversaId(c.id);
  };

  const enviar = async (pergunta: string) => {
    const limpo = pergunta.trim();
    if (!limpo || enviando) return;
    if (semCreditos) {
      toast.error(
        `Sem créditos suficientes hoje (cada pergunta custa ${CUSTO}). Renova à 00:00 ou faça upgrade.`,
        {
          duration: 7000,
          // Botão de upgrade só aparece se o WhatsApp estiver configurado
          ...(upgradeUrl && {
            action: {
              label: "Fazer upgrade",
              onClick: () => window.open(upgradeUrl, "_blank", "noopener"),
            },
          }),
        }
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

  const salvarTitulo = (id: string) => {
    renomear(id, tituloEdit);
    setEditandoId(null);
  };

  return (
    <div className="space-y-6">
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
          <CreditosBadge />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Painel lateral: conversas anteriores */}
        <aside className="rounded-xl border border-border bg-card shadow-elevacao flex flex-col max-h-[520px]">
          <div className="p-3 border-b border-border">
            <button
              onClick={novaConversa}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nova conversa
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversas.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 px-2">
                Suas conversas aparecem aqui.
              </p>
            ) : (
              conversas.map((c) => (
                <div
                  key={c.id}
                  className={`group rounded-lg px-2.5 py-2 text-sm cursor-pointer transition-colors ${
                    c.id === conversaId
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  }`}
                  onClick={() => editandoId !== c.id && abrirConversa(c.id)}
                >
                  {editandoId === c.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={tituloEdit}
                        onChange={(e) => setTituloEdit(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") salvarTitulo(c.id);
                          if (e.key === "Escape") setEditandoId(null);
                        }}
                        autoFocus
                        className="flex-1 min-w-0 rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          salvarTitulo(c.id);
                        }}
                        className="p-1 text-sucesso hover:text-sucesso"
                        title="Salvar"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditandoId(null);
                        }}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="flex-1 truncate">{c.titulo}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditandoId(c.id);
                          setTituloEdit(c.titulo);
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                        title="Renomear"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          excluir(c.id);
                          if (c.id === conversaId) novaConversa();
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        title="Excluir conversa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <p className="text-[0.625rem] text-muted-foreground p-2.5 border-t border-border leading-snug">
            As conversas ficam só neste navegador. Se limpar os dados do
            navegador ou abrir em outro dispositivo, elas não aparecem.
          </p>
        </aside>

        {/* Janela da conversa */}
        <div className="rounded-xl border border-border bg-card shadow-elevacao flex flex-col min-h-[420px]">
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
            <div className="border-t border-border px-4 py-2.5 text-xs text-destructive bg-destructive/5 flex items-center gap-2 flex-wrap">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="flex-1 min-w-0">
                Sem créditos suficientes hoje (cada pergunta custa {CUSTO}).
                Renova à 00:00 ou faça upgrade do plano.
              </span>
              <UpgradeWhatsappButton label="Fazer upgrade" size="sm" />
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
      </div>

      <p className="text-[0.6875rem] text-muted-foreground">
        Respostas geradas por IA (llama-3.3-70b) a partir dos seus dados reais.
        Use como apoio à decisão, não como aconselhamento financeiro definitivo.
      </p>
    </div>
  );
}

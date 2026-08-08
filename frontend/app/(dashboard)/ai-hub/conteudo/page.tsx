"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { History, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormularioConteudo } from "@/components/ai_hub/FormularioConteudo";
import { ResultadoIA } from "@/components/ai_hub/ResultadoIA";
import { InsightCard } from "@/components/ai_hub/InsightCard";
import { CreditosBadge } from "@/components/ai_hub/CreditosBadge";
import { useAIHub } from "@/hooks/useAIHub";
import type { SolicitacaoConteudo } from "@/types/ai_hub";

export default function AIHubPage() {
  const { gerando, taskAtual, erro, insight, gerarConteudo, toggleFavorito } =
    useAIHub();
  const [resultado, setResultado] = useState<string | null>(null);
  const [ultimoConteudoId, setUltimoConteudoId] = useState<string | null>(null);

  // Toast quando faltam créditos (rejeição na porta)
  useEffect(() => {
    if (erro && erro.toLowerCase().includes("crédito")) {
      toast.error(erro, { duration: 7000 });
    }
  }, [erro]);

  const handleGerar = async (solicitacao: SolicitacaoConteudo) => {
    setResultado(null);
    setUltimoConteudoId(null);
    await gerarConteudo(solicitacao, (res) => {
      setResultado(res);
    });
    // Após concluir, o taskAtual.id é o ID da task — o ConteudoGerado tem ID diferente
    // Usamos o histórico para obter o ID do conteúdo mais recente
  };

  const handleGerarInsight = async () => {
    setResultado(null);
    await gerarConteudo({ tipo: "insight", parametros: {} }, (res) => {
      setResultado(res);
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-brand-500" />
            AI Hub
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gere conteúdo de marketing e insights para o seu negócio com inteligência artificial
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CreditosBadge />
          <Link href="/ai-hub/historico">
            <Button variant="outline" size="sm" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </Button>
          </Link>
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda: Formulário */}
        <div className="lg:col-span-1 space-y-4">
          <FormularioConteudo
            onSubmit={handleGerar}
            gerando={gerando}
            erro={erro}
          />
        </div>

        {/* Coluna direita: Resultado + Insight */}
        <div className="lg:col-span-2 space-y-4">
          <ResultadoIA
            taskAtual={taskAtual}
            resultado={resultado}
            gerando={gerando}
            onFavoritar={
              ultimoConteudoId
                ? () => toggleFavorito(ultimoConteudoId)
                : undefined
            }
          />
          <InsightCard
            insight={insight}
            onGerarInsight={handleGerarInsight}
            gerando={gerando}
          />
        </div>
      </div>

      {/* Dicas de uso */}
      <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
        <h3 className="text-sm font-semibold text-brand-800 mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Dicas para melhores resultados
        </h3>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-brand-700">
          <li className="flex items-start gap-1.5">
            <span className="text-brand-400 mt-0.5">→</span>
            Seja específico no nome do produto ou serviço
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-brand-400 mt-0.5">→</span>
            Informe o tom desejado (urgente, descontraído, profissional)
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-brand-400 mt-0.5">→</span>
            Use o Relatório do Negócio para análises mensais completas
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-brand-400 mt-0.5">→</span>
            Salve os melhores conteúdos como favoritos para reutilizar
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-brand-400 mt-0.5">→</span>
            O insight semanal usa dados reais do seu negócio
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-brand-400 mt-0.5">→</span>
            Use o Pedido Livre para qualquer conteúdo fora dos tipos prontos
          </li>
        </ul>
      </div>
    </div>
  );
}

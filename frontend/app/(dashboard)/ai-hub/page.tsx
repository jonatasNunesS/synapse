"use client";

import { useState } from "react";
import Link from "next/link";
import { History, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormularioConteudo } from "@/components/ai_hub/FormularioConteudo";
import { ResultadoIA } from "@/components/ai_hub/ResultadoIA";
import { UsoIACard } from "@/components/ai_hub/UsoIACard";
import { InsightCard } from "@/components/ai_hub/InsightCard";
import { useAIHub } from "@/hooks/useAIHub";
import type { SolicitacaoConteudo } from "@/types/ai_hub";

export default function AIHubPage() {
  const { gerando, taskAtual, erro, setErro, uso, insight, gerarConteudo, toggleFavorito } =
    useAIHub();
  const [resultado, setResultado] = useState<string | null>(null);
  const [ultimoConteudoId, setUltimoConteudoId] = useState<string | null>(null);

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
            <Sparkles className="h-6 w-6 text-purple-500" />
            AI Hub
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gere conteúdo de marketing e insights para o seu negócio com inteligência artificial
          </p>
        </div>
        <Link href="/ai-hub/historico">
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </Button>
        </Link>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda: Formulário + Uso */}
        <div className="lg:col-span-1 space-y-4">
          <UsoIACard uso={uso} />
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
      <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
        <h3 className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Dicas para melhores resultados
        </h3>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-purple-700">
          <li className="flex items-start gap-1.5">
            <span className="text-purple-400 mt-0.5">→</span>
            Seja específico no nome do produto ou serviço
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-purple-400 mt-0.5">→</span>
            Informe o tom desejado (urgente, descontraído, profissional)
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-purple-400 mt-0.5">→</span>
            Use o Relatório do Negócio para análises mensais completas
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-purple-400 mt-0.5">→</span>
            Salve os melhores conteúdos como favoritos para reutilizar
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-purple-400 mt-0.5">→</span>
            O insight semanal usa dados reais do seu negócio
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-purple-400 mt-0.5">→</span>
            Propostas comerciais ficam melhores com valor e prazo preenchidos
          </li>
        </ul>
      </div>
    </div>
  );
}

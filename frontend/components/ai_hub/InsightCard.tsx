"use client";

import { Lightbulb, Clock, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ConteudoGerado } from "@/types/ai_hub";

interface InsightCardProps {
  insight: ConteudoGerado | null;
  onGerarInsight?: () => void;
  gerando?: boolean;
}

export function InsightCard({ insight, onGerarInsight, gerando }: InsightCardProps) {
  if (!insight) {
    return (
      <Card className="border-dashed border-amber-200 bg-amber-50/50">
        <CardContent className="p-6 text-center">
          <Lightbulb className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700 mb-1">
            Nenhum insight disponível ainda
          </p>
          <p className="text-xs text-slate-500 mb-4">
            Os insights semanais são gerados automaticamente toda segunda-feira,
            ou você pode gerar um agora.
          </p>
          {onGerarInsight && (
            <button
              onClick={onGerarInsight}
              disabled={gerando}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              {gerando ? "Gerando..." : "Gerar Insight Agora"}
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  const linhas = insight.resultado
    .split("\n")
    .filter((l) => l.trim())
    .slice(0, 6);

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0" />
            Insight Semanal da IA
          </CardTitle>
          <Badge variant="outline" className="text-xs border-amber-200 text-amber-700 flex-shrink-0">
            <Clock className="h-3 w-3 mr-1" />
            {new Date(insight.criado_em).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {linhas.map((linha, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="text-amber-500 font-bold flex-shrink-0 mt-0.5">
                {linha.match(/^\d+\./) ? "" : "→"}
              </span>
              <span>{linha.replace(/^[\d\.\-\*\→]+\s*/, "")}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-400 mt-3">
          Modelo: {insight.modelo_usado} · {insight.tokens_usados} tokens
        </p>
      </CardContent>
    </Card>
  );
}

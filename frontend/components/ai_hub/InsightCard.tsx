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
      <Card className="border-dashed border-alerta/30 bg-alerta/5">
        <CardContent className="p-6 text-center">
          <Lightbulb className="h-10 w-10 text-alerta mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">
            Nenhum insight disponível ainda
          </p>
          <p className="text-xs text-muted-suave mb-4">
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

  if (!insight.resultado) {
    return (
      <Card className="border-dashed border-alerta/30 bg-alerta/5">
        <CardContent className="p-6 text-center">
          <Lightbulb className="h-10 w-10 text-alerta mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">
            Gerando insight...
          </p>
          <p className="text-xs text-muted-suave">
            Seu insight semanal está sendo processado. Aguarde alguns instantes.
          </p>
        </CardContent>
      </Card>
    );
  }

  const linhas = insight.resultado
    .split("\n")
    .filter((l) => l.trim())
    .slice(0, 6);

  return (
    <Card className="border-alerta/30 bg-alerta/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-alerta flex-shrink-0" />
            Insight Semanal da IA
          </CardTitle>
          <Badge variant="outline" className="text-xs border-alerta/40 text-alerta flex-shrink-0">
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
            <li key={i} className="flex items-start gap-2 text-sm text-foreground-suave">
              <span className="text-alerta font-bold flex-shrink-0 mt-0.5">
                {linha.match(/^\d+\./) ? "" : "→"}
              </span>
              <span>{linha.replace(/^[\d\.\-\*\→]+\s*/, "")}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-3">
          Modelo: {insight.modelo_usado} · {insight.tokens_usados} tokens
        </p>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Copy, Check, Star, Loader2, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TaskIA } from "@/types/ai_hub";

interface ResultadoIAProps {
  taskAtual: TaskIA | null;
  resultado: string | null;
  gerando: boolean;
  onFavoritar?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Na fila...",
  processando: "Gerando com IA...",
  concluido: "Concluído",
  erro: "Erro",
};

const STATUS_CORES: Record<string, string> = {
  pendente: "bg-slate-100 text-slate-600",
  processando: "bg-blue-100 text-blue-700",
  concluido: "bg-emerald-100 text-emerald-700",
  erro: "bg-red-100 text-red-700",
};

export function ResultadoIA({ taskAtual, resultado, gerando, onFavoritar }: ResultadoIAProps) {
  const [copiado, setCopiado] = useState(false);

  const copiarTexto = async () => {
    if (!resultado) return;
    await navigator.clipboard.writeText(resultado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  // Estado vazio (nenhuma geração iniciada)
  if (!gerando && !taskAtual && !resultado) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <Cpu className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            O resultado da geração aparecerá aqui
          </p>
        </CardContent>
      </Card>
    );
  }

  // Gerando (polling)
  if (gerando && taskAtual && taskAtual.status !== "concluido") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Resultado
            </CardTitle>
            <Badge className={STATUS_CORES[taskAtual.status] || "bg-slate-100 text-slate-600"}>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              {STATUS_LABELS[taskAtual.status] || taskAtual.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-4 bg-slate-100 rounded animate-pulse"
                style={{ width: `${85 - i * 10}%` }}
              />
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-4 text-center">
            A IA está trabalhando no seu conteúdo...
          </p>
        </CardContent>
      </Card>
    );
  }

  // Resultado disponível
  if (resultado) {
    return (
      <Card className="border-emerald-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              Conteúdo Gerado
            </CardTitle>
            <div className="flex items-center gap-2">
              {onFavoritar && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onFavoritar}
                  className="h-8 px-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                  aria-label="Favoritar conteúdo"
                >
                  <Star className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={copiarTexto}
                className="h-8 px-2"
              >
                {copiado ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span className="ml-1 text-xs">{copiado ? "Copiado!" : "Copiar"}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed border border-slate-100">
            {resultado}
          </div>
          {taskAtual && (
            <p className="text-xs text-slate-400 mt-2">
              Modelo: {taskAtual.resultado ? "concluído" : "—"} ·{" "}
              {taskAtual.concluido_em
                ? new Date(taskAtual.concluido_em).toLocaleTimeString("pt-BR")
                : ""}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}

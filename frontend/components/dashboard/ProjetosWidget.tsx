"use client";

import Link from "next/link";
import { FolderOpen, AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import type { ProjetoDashboard } from "@/types/dashboard";

interface ProjetosWidgetProps {
  projetos: ProjetoDashboard[];
  isLoading: boolean;
}

const PRIORIDADE_COR: Record<string, string> = {
  baixa: "text-gray-500",
  media: "text-blue-500",
  alta: "text-yellow-500",
  urgente: "text-red-500",
};

export function ProjetosWidget({ projetos, isLoading }: ProjetosWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-cyan-500" />
            Projetos em Andamento
          </CardTitle>
          <Link
            href="/projetos"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {projetos.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            Nenhum projeto em andamento.
          </div>
        ) : (
          <div className="space-y-4">
            {projetos.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                href={`/projetos/${p.id}`}
                className="block group"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Cor do projeto */}
                    <div
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.cor }}
                    />
                    <p className="text-sm font-medium truncate group-hover:text-foreground">
                      {p.nome}
                    </p>
                    {p.atrasado && (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                    {p.progresso}%
                  </span>
                </div>

                {/* Barra de progresso */}
                <Progress
                  value={p.progresso}
                  className="h-1.5"
                />

                {/* Metadados */}
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-xs ${PRIORIDADE_COR[p.prioridade] ?? "text-gray-500"}`}>
                    {p.prioridade}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.tarefas_concluidas}/{p.tarefas_total} tarefas
                    {p.data_prazo && (
                      <span className={p.atrasado ? "text-red-500 ml-1" : "ml-1"}>
                        · {p.atrasado ? "Atrasado" : `prazo: ${p.data_prazo.split("-").reverse().join("/")}`}
                      </span>
                    )}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

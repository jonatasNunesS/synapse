"use client";

import Link from "next/link";
import { CheckSquare, AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { TarefaDashboard } from "@/types/dashboard";

const PRIORIDADE_BADGE: Record<string, string> = {
  baixa: "bg-gray-100 text-gray-700",
  media: "bg-blue-100 text-blue-700",
  alta: "bg-yellow-100 text-yellow-700",
  urgente: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  a_fazer: "A fazer",
  em_progresso: "Em progresso",
  revisao: "Revisão",
  bloqueado: "Bloqueado",
};

interface MinhasTarefasWidgetProps {
  tarefas: TarefaDashboard[];
  isLoading: boolean;
}

export function MinhasTarefasWidget({ tarefas, isLoading }: MinhasTarefasWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
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
            <CheckSquare className="h-4 w-4 text-orange-500" />
            Minhas Tarefas
          </CardTitle>
          <Link
            href="/projetos"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            Ver todas <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {tarefas.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            Nenhuma tarefa pendente.
          </div>
        ) : (
          <div className="space-y-2">
            {tarefas.slice(0, 6).map((tarefa) => (
              <Link
                key={tarefa.id}
                href={`/projetos/${tarefa.projeto_id}`}
                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors group"
              >
                {/* Ícone de alerta se atrasada */}
                <div className="mt-0.5 flex-shrink-0">
                  {tarefa.atrasada ? (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate group-hover:text-foreground ${tarefa.atrasada ? "text-red-600" : "text-foreground"}`}>
                    {tarefa.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {tarefa.projeto_nome}
                    {tarefa.data_prazo && (
                      <span className={tarefa.atrasada ? "text-red-500 ml-1" : "ml-1"}>
                        · {tarefa.atrasada ? "Atrasada" : `${tarefa.dias_restantes}d`}
                      </span>
                    )}
                  </p>
                </div>

                {/* Badges */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORIDADE_BADGE[tarefa.prioridade] ?? "bg-gray-100 text-gray-700"}`}>
                    {tarefa.prioridade}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {STATUS_LABEL[tarefa.status] ?? tarefa.status}
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

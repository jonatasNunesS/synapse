"use client";

import {
  DollarSign,
  Package,
  Users,
  MessageSquare,
  CheckSquare,
  FolderOpen,
  FileText,
  UserPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AtividadeEvento, AtividadeTipo } from "@/types/dashboard";

const ICONES: Record<AtividadeTipo, React.ReactNode> = {
  lancamento: <DollarSign className="h-3.5 w-3.5" />,
  movimentacao: <Package className="h-3.5 w-3.5" />,
  cliente: <Users className="h-3.5 w-3.5" />,
  interacao: <MessageSquare className="h-3.5 w-3.5" />,
  tarefa: <CheckSquare className="h-3.5 w-3.5" />,
  projeto: <FolderOpen className="h-3.5 w-3.5" />,
  documento: <FileText className="h-3.5 w-3.5" />,
  membro: <UserPlus className="h-3.5 w-3.5" />,
};

const CORES: Record<AtividadeTipo, string> = {
  lancamento: "text-green-600 bg-green-50",
  movimentacao: "text-blue-600 bg-blue-50",
  cliente: "text-purple-600 bg-purple-50",
  interacao: "text-indigo-600 bg-indigo-50",
  tarefa: "text-orange-600 bg-orange-50",
  projeto: "text-cyan-600 bg-cyan-50",
  documento: "text-gray-600 bg-gray-100",
  membro: "text-pink-600 bg-pink-50",
};

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  if (diffHr < 24) return `${diffHr}h atrás`;
  if (diffDay === 1) return "ontem";
  if (diffDay < 7) return `${diffDay} dias atrás`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

interface AtividadeWidgetProps {
  eventos: AtividadeEvento[];
  isLoading: boolean;
}

export function AtividadeWidget({ eventos, isLoading }: AtividadeWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Atividade Recente</CardTitle>
      </CardHeader>
      <CardContent>
        {eventos.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            Nenhuma atividade recente.
          </div>
        ) : (
          <div className="space-y-3">
            {eventos.map((evento, index) => (
              <div key={index} className="flex items-start gap-3">
                {/* Ícone */}
                <div className={`p-1.5 rounded-full flex-shrink-0 ${CORES[evento.tipo] ?? "text-gray-600 bg-gray-100"}`}>
                  {ICONES[evento.tipo]}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{evento.titulo}</p>
                  {evento.descricao && (
                    <p className="text-xs text-muted-foreground truncate">{evento.descricao}</p>
                  )}
                </div>

                {/* Tempo relativo */}
                <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                  {formatRelativeTime(evento.data)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Bell, CheckCheck, Trash2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import type { Notificacao, TipoNotificacao } from "@/types/notificacoes";
import {
  TIPO_NOTIFICACAO_LABELS,
  PRIORIDADE_NOTIFICACAO_COLORS,
} from "@/types/notificacoes";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";

const PRIORIDADE_BADGE: Record<string, string> = {
  normal: "secondary",
  alta: "outline",
  urgente: "destructive",
};

function NotificacaoCard({
  notificacao,
  onMarcarLida,
  onDeletar,
}: {
  notificacao: Notificacao;
  onMarcarLida: (id: string) => void;
  onDeletar: (id: string) => void;
}) {
  const router = useRouter();

  return (
    <Card
      className={cn(
        "transition-all",
        !notificacao.lida && "border-l-4 border-l-blue-500"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {TIPO_NOTIFICACAO_LABELS[notificacao.tipo]}
              </Badge>
              <Badge
                variant={
                  (PRIORIDADE_BADGE[notificacao.prioridade] as
                    | "secondary"
                    | "outline"
                    | "destructive") ?? "secondary"
                }
                className="text-xs"
              >
                {notificacao.prioridade}
              </Badge>
              {!notificacao.lida && (
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </div>
            <h3
              className={cn(
                "font-medium text-sm",
                PRIORIDADE_NOTIFICACAO_COLORS[notificacao.prioridade]
              )}
            >
              {notificacao.titulo}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {notificacao.mensagem}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(notificacao.criado_em), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
              {notificacao.acao_url && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => router.push(notificacao.acao_url)}
                >
                  Ver detalhes
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!notificacao.lida && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Marcar como lida"
                onClick={() => onMarcarLida(notificacao.id)}
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="Excluir"
              onClick={() => onDeletar(notificacao.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NotificacoesPage() {
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroLida, setFiltroLida] = useState<string>("todas");
  const [page, setPage] = useState(1);

  const { notificacoes, pagination, isLoading, marcarLida, marcarTodasLidas, deletar } =
    useNotificacoes({
      tipo: filtroTipo !== "todos" ? filtroTipo : undefined,
      lida: filtroLida === "nao_lidas" ? false : filtroLida === "lidas" ? true : undefined,
      page,
    });

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notificações
          </h1>
          {naoLidas > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {naoLidas} não lida{naoLidas > 1 ? "s" : ""}
            </p>
          )}
        </div>
        {naoLidas > 0 && (
          <Button variant="outline" size="sm" onClick={marcarTodasLidas}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros:</span>
        </div>
        <Select value={filtroTipo} onValueChange={(v) => { setFiltroTipo(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(TIPO_NOTIFICACAO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroLida} onValueChange={(v) => { setFiltroLida(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="nao_lidas">Não lidas</SelectItem>
            <SelectItem value="lidas">Lidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : notificacoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Bell className="h-12 w-12 opacity-30" />
          <p className="text-lg font-medium">Nenhuma notificação</p>
          <p className="text-sm">Você está em dia com tudo!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notificacoes.map((n) => (
            <NotificacaoCard
              key={n.id}
              notificacao={n}
              onMarcarLida={marcarLida}
              onDeletar={deletar}
            />
          ))}
        </div>
      )}

      {/* Paginação */}
      {pagination && pagination.count > 25 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            {pagination.count} notificações no total
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.previous}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.next}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

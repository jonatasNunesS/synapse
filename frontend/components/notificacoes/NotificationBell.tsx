"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useContagemNotificacoes, useNotificacoesNaoLidas } from "@/hooks/useNotificacoes";
import type { Notificacao } from "@/types/notificacoes";
import { PRIORIDADE_NOTIFICACAO_COLORS, TIPO_NOTIFICACAO_LABELS } from "@/types/notificacoes";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function NotificacaoItem({
  notificacao,
  onMarcarLida,
}: {
  notificacao: Notificacao;
  onMarcarLida: (id: string) => void;
}) {
  const router = useRouter();

  const handleClick = () => {
    if (!notificacao.lida) {
      onMarcarLida(notificacao.id);
    }
    if (notificacao.acao_url) {
      router.push(notificacao.acao_url);
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
        !notificacao.lida && "bg-blue-50/50 dark:bg-blue-950/20"
      )}
      onClick={handleClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-muted-foreground">
            {TIPO_NOTIFICACAO_LABELS[notificacao.tipo]}
          </span>
          {!notificacao.lida && (
            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          )}
        </div>
        <p
          className={cn(
            "text-sm font-medium truncate",
            PRIORIDADE_NOTIFICACAO_COLORS[notificacao.prioridade]
          )}
        >
          {notificacao.titulo}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notificacao.mensagem}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notificacao.criado_em), {
            addSuffix: true,
            locale: ptBR,
          })}
        </p>
      </div>
      {notificacao.acao_url && (
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1" />
      )}
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { count } = useContagemNotificacoes();
  const { notificacoes, isLoading, marcarLida, marcarTodasLidas } =
    useNotificacoesNaoLidas();
  const router = useRouter();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {count > 99 ? "99+" : count}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <h3 className="font-semibold text-sm">Notificações</h3>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => marcarTodasLidas()}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[320px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : notificacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 gap-2">
              <Bell className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="p-1">
              {notificacoes.map((n) => (
                <NotificacaoItem
                  key={n.id}
                  notificacao={n}
                  onMarcarLida={marcarLida}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setOpen(false);
              router.push("/notificacoes");
            }}
          >
            Ver todas as notificações
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

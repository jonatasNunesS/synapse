"use client";
/**
 * Synapse — Agenda v1: Detalhe do Evento (modal).
 * Mostra os dados e, se vinculado, o cliente com link pro perfil no CRM.
 */
import Link from "next/link";
import { X, Pencil, Trash2, MapPin, Clock, User, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Evento } from "@/types/agenda";

interface EventoDetalheProps {
  evento: Evento;
  onEditar: () => void;
  onExcluir: () => void;
  onFechar: () => void;
  excluindo?: boolean;
}

function periodo(evento: Evento): string {
  const ini = new Date(evento.data_inicio);
  const fim = new Date(evento.data_fim);
  if (evento.dia_inteiro) {
    return format(ini, "PPP", { locale: ptBR }) + " · Dia inteiro";
  }
  const mesmodia = ini.toDateString() === fim.toDateString();
  if (mesmodia) {
    return `${format(ini, "PPP", { locale: ptBR })} · ${format(ini, "HH:mm")} – ${format(fim, "HH:mm")}`;
  }
  return `${format(ini, "PPp", { locale: ptBR })} → ${format(fim, "PPp", { locale: ptBR })}`;
}

export function EventoDetalhe({ evento, onEditar, onExcluir, onFechar, excluindo }: EventoDetalheProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: evento.cor }} />
            <h2 className="text-lg font-semibold text-foreground truncate">{evento.titulo}</h2>
          </div>
          <button onClick={onFechar} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock size={15} />
            <span className="text-foreground">{periodo(evento)}</span>
          </div>

          {evento.local && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin size={15} />
              <span className="text-foreground">{evento.local}</span>
            </div>
          )}

          {evento.cliente && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User size={15} />
              <Link
                href={`/clientes/${evento.cliente}`}
                className="text-brand-accent hover:underline"
              >
                {evento.cliente_nome ?? "Ver cliente"}
              </Link>
            </div>
          )}

          {evento.descricao && (
            <p className="text-foreground whitespace-pre-wrap pt-1 border-t border-border/60">
              {evento.descricao}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onExcluir}
            disabled={excluindo}
            className="px-3 py-2 text-sm font-medium text-destructive bg-destructive/10 rounded-lg hover:bg-destructive/20 transition-colors flex items-center gap-1.5 disabled:opacity-60"
          >
            {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={15} />}
            Excluir
          </button>
          <button
            onClick={onEditar}
            className="px-3 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          >
            <Pencil size={15} />
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

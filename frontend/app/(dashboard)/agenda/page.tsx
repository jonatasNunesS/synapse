"use client";
/**
 * Synapse — Agenda v1: página do calendário.
 * Visões mês/semana/dia; criar clicando num dia; clicar num evento abre detalhe.
 */
import { useCallback, useEffect, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  addHours,
} from "date-fns";
import { Views, type View, type SlotInfo } from "react-big-calendar";
import { toast } from "sonner";
import { CalendarDays, Plus } from "lucide-react";
import { AgendaCalendario } from "@/components/agenda/AgendaCalendario";
import { EventoForm } from "@/components/agenda/EventoForm";
import { EventoDetalhe } from "@/components/agenda/EventoDetalhe";
import { useAgenda } from "@/hooks/useAgenda";
import { getErrorMessage } from "@/lib/api";
import type { Evento, EventoPayload } from "@/types/agenda";

// Intervalo visível conforme a visão atual (com folga para semanas parciais)
function intervaloVisivel(date: Date, view: View): { inicio: Date; fim: Date } {
  if (view === Views.MONTH) {
    return {
      inicio: startOfWeek(startOfMonth(date), { weekStartsOn: 0 }),
      fim: endOfWeek(endOfMonth(date), { weekStartsOn: 0 }),
    };
  }
  if (view === Views.WEEK) {
    return { inicio: startOfWeek(date, { weekStartsOn: 0 }), fim: endOfWeek(date, { weekStartsOn: 0 }) };
  }
  return { inicio: startOfDay(date), fim: endOfDay(date) };
}

export default function AgendaPage() {
  const { eventos, loading, carregar, criar, atualizar, deletar } = useAgenda();

  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState<Date>(new Date());

  const [formAberto, setFormAberto] = useState(false);
  const [eventoEditando, setEventoEditando] = useState<Evento | null>(null);
  const [slotInicial, setSlotInicial] = useState<{ inicio: Date; fim: Date } | null>(null);

  const [detalhe, setDetalhe] = useState<Evento | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Recarrega os eventos do intervalo visível
  const recarregar = useCallback(async () => {
    const { inicio, fim } = intervaloVisivel(date, view);
    try {
      await carregar(inicio, fim);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [date, view, carregar]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // ── Handlers ──────────────────────────────────────────────
  const abrirNovoEvento = (slot?: { inicio: Date; fim: Date }) => {
    setEventoEditando(null);
    setSlotInicial(slot ?? null);
    setFormAberto(true);
  };

  const handleSelectSlot = (slot: SlotInfo) => {
    const inicio = slot.start as Date;
    // Slot de mês costuma vir com allDay; damos 1h de duração padrão
    const fim = slot.end && slot.end > inicio ? (slot.end as Date) : addHours(inicio, 1);
    abrirNovoEvento({ inicio, fim });
  };

  const handleSalvar = async (dados: EventoPayload) => {
    if (eventoEditando) {
      await atualizar(eventoEditando.id, dados);
      toast.success("Evento atualizado.");
    } else {
      await criar(dados);
      toast.success("Evento criado.");
    }
    await recarregar();
  };

  const handleEditarDoDetalhe = () => {
    if (!detalhe) return;
    setEventoEditando(detalhe);
    setSlotInicial(null);
    setDetalhe(null);
    setFormAberto(true);
  };

  const handleExcluir = async () => {
    if (!detalhe) return;
    if (!confirm(`Excluir o evento "${detalhe.titulo}"?`)) return;
    setExcluindo(true);
    try {
      await deletar(detalhe.id);
      toast.success("Evento excluído.");
      setDetalhe(null);
      await recarregar();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Agenda
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Seus eventos e compromissos em um só lugar.
          </p>
        </div>
        <button
          onClick={() => abrirNovoEvento()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Evento
        </button>
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground">Carregando eventos…</p>
      )}

      <AgendaCalendario
        eventos={eventos}
        view={view}
        date={date}
        onView={setView}
        onNavigate={setDate}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={setDetalhe}
      />

      {formAberto && (
        <EventoForm
          evento={eventoEditando}
          slotInicial={slotInicial}
          onSalvar={handleSalvar}
          onFechar={() => setFormAberto(false)}
        />
      )}

      {detalhe && (
        <EventoDetalhe
          evento={detalhe}
          onEditar={handleEditarDoDetalhe}
          onExcluir={handleExcluir}
          onFechar={() => setDetalhe(null)}
          excluindo={excluindo}
        />
      )}
    </div>
  );
}

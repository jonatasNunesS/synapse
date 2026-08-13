"use client";

import { useMemo } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type View,
  type SlotInfo,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import type { Evento } from "@/types/agenda";

const locales = { "pt-BR": ptBR };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: ptBR }),
  getDay,
  locales,
});

const MENSAGENS = {
  date: "Data",
  time: "Hora",
  event: "Evento",
  allDay: "Dia inteiro",
  week: "Semana",
  work_week: "Semana útil",
  day: "Dia",
  month: "Mês",
  previous: "Anterior",
  next: "Próximo",
  yesterday: "Ontem",
  tomorrow: "Amanhã",
  today: "Hoje",
  agenda: "Agenda",
  noEventsInRange: "Nenhum evento neste período.",
  showMore: (total: number) => `+${total} mais`,
};

export interface CalendarioEvento {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: Evento;
}

interface AgendaCalendarioProps {
  eventos: Evento[];
  view: View;
  date: Date;
  onView: (v: View) => void;
  onNavigate: (d: Date) => void;
  onSelectSlot: (slot: SlotInfo) => void;
  onSelectEvent: (evento: Evento) => void;
}

export function AgendaCalendario({
  eventos,
  view,
  date,
  onView,
  onNavigate,
  onSelectSlot,
  onSelectEvent,
}: AgendaCalendarioProps) {
  const items: CalendarioEvento[] = useMemo(
    () =>
      eventos.map((e) => ({
        id: e.id,
        title: e.titulo,
        start: new Date(e.data_inicio),
        end: new Date(e.data_fim),
        allDay: e.dia_inteiro,
        resource: e,
      })),
    [eventos]
  );

  return (
    <div className="rbc-synapse h-[75vh] rounded-xl border border-border bg-card shadow-elevacao p-3">
      <Calendar<CalendarioEvento>
        localizer={localizer}
        culture="pt-BR"
        messages={MENSAGENS}
        events={items}
        startAccessor="start"
        endAccessor="end"
        allDayAccessor="allDay"
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        view={view}
        date={date}
        onView={onView}
        onNavigate={onNavigate}
        selectable
        popup
        onSelectSlot={onSelectSlot}
        onSelectEvent={(item) => onSelectEvent(item.resource)}
        eventPropGetter={(item) => ({
          style: { backgroundColor: item.resource.cor || "var(--brand-primary)" },
        })}
        style={{ height: "100%" }}
      />
    </div>
  );
}

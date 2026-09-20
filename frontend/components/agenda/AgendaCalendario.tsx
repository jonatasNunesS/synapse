"use client";

import { useMemo } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type View,
  type SlotInfo,
} from "react-big-calendar";
import withDragAndDrop, {
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
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

/**
 * Quantos dias a visão de lista cobre a partir da data atual.
 *
 * É o `length` do react-big-calendar, passado explicitamente porque a página
 * precisa buscar no backend exatamente o período que a lista vai mostrar —
 * deixar os dois lados dependerem do default da biblioteca seria um jeito
 * silencioso de a lista mostrar menos do que existe.
 */
export const DIAS_NA_LISTA = 30;

export interface CalendarioEvento {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: Evento;
}

/** O que um arraste (ou redimensionamento) pede: este evento, neste período. */
export interface Remarcacao {
  evento: Evento;
  inicio: Date;
  fim: Date;
  /** Onde o calendário entendeu que o evento foi solto: faixa de dia inteiro? */
  viraDiaInteiro: boolean;
}

/**
 * O calendário com arrastar e redimensionar.
 *
 * Criado fora do componente: `withDragAndDrop` devolve um componente NOVO, e
 * recriá-lo a cada render faria o React desmontar e remontar o calendário
 * inteiro a cada teclada em qualquer estado da página.
 */
const CalendarioArrastavel = withDragAndDrop<CalendarioEvento>(Calendar);

interface AgendaCalendarioProps {
  eventos: Evento[];
  view: View;
  date: Date;
  onView: (v: View) => void;
  onNavigate: (d: Date) => void;
  onSelectSlot: (slot: SlotInfo) => void;
  onSelectEvent: (evento: Evento) => void;
  /** Arrastou ou esticou um evento. Ausente → calendário só de leitura. */
  onRemarcar?: (r: Remarcacao) => void;
}

export function AgendaCalendario({
  eventos,
  view,
  date,
  onView,
  onNavigate,
  onSelectSlot,
  onSelectEvent,
  onRemarcar,
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

  // O calendário entrega `stringOrDate`; a página trabalha com Date.
  const remarcar = ({ event, start, end, isAllDay }: EventInteractionArgs<CalendarioEvento>) =>
    onRemarcar?.({
      evento: event.resource,
      inicio: new Date(start),
      fim: new Date(end),
      viraDiaInteiro: !!isAllDay,
    });

  return (
    <div className="rbc-synapse h-[75vh] rounded-xl border border-border bg-card shadow-elevacao p-3">
      <CalendarioArrastavel
        localizer={localizer}
        culture="pt-BR"
        messages={MENSAGENS}
        events={items}
        startAccessor="start"
        endAccessor="end"
        allDayAccessor="allDay"
        // A lista (Views.AGENDA) é a visão que salva o celular: o mês em
        // 375px dá ~50px por coluna, onde um título vira três pixels de cor.
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        length={DIAS_NA_LISTA}
        view={view}
        date={date}
        onView={onView}
        onNavigate={onNavigate}
        selectable
        popup
        onSelectSlot={onSelectSlot}
        onSelectEvent={(item) => onSelectEvent(item.resource)}
        // Arrastar para remarcar e esticar para mudar a duração. No toque, o
        // rbc só inicia o arraste depois de um long press (250ms), então um
        // toque simples continua abrindo o evento em vez de movê-lo sem querer.
        onEventDrop={onRemarcar ? remarcar : undefined}
        onEventResize={onRemarcar ? remarcar : undefined}
        resizable={!!onRemarcar}
        draggableAccessor={() => !!onRemarcar}
        eventPropGetter={(item) => ({
          style: { backgroundColor: item.resource.cor || "var(--brand-primary)" },
        })}
        style={{ height: "100%" }}
      />
    </div>
  );
}

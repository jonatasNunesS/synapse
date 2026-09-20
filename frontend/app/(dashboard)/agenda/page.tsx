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
  addDays,
  addMinutes,
} from "date-fns";
import { Views, type View, type SlotInfo } from "react-big-calendar";
import { toast } from "sonner";
import { CalendarDays, Plus } from "lucide-react";
import {
  AgendaCalendario,
  DIAS_NA_LISTA,
  type Remarcacao,
} from "@/components/agenda/AgendaCalendario";
import { EventoForm } from "@/components/agenda/EventoForm";
import { EventoDetalhe } from "@/components/agenda/EventoDetalhe";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAgenda } from "@/hooks/useAgenda";
import { useDuracaoPadrao, useExpediente } from "@/hooks/useExpediente";
import { useTelaEstreita } from "@/hooks/useTelaEstreita";
import { getErrorMessage } from "@/lib/api";
import type { Evento, EventoPayload } from "@/types/agenda";

// Intervalo visível conforme a visão atual (com folga para semanas parciais)
export function intervaloVisivel(date: Date, view: View): { inicio: Date; fim: Date } {
  if (view === Views.MONTH) {
    return {
      inicio: startOfWeek(startOfMonth(date), { weekStartsOn: 0 }),
      fim: endOfWeek(endOfMonth(date), { weekStartsOn: 0 }),
    };
  }
  if (view === Views.WEEK) {
    return { inicio: startOfWeek(date, { weekStartsOn: 0 }), fim: endOfWeek(date, { weekStartsOn: 0 }) };
  }
  // A lista olha para a frente: da data atual até `DIAS_NA_LISTA` dias depois.
  // Sem este caso ela cairia no intervalo de um dia só e mostraria um período
  // bem menor do que diz cobrir.
  if (view === Views.AGENDA) {
    return { inicio: startOfDay(date), fim: endOfDay(addDays(date, DIAS_NA_LISTA)) };
  }
  return { inicio: startOfDay(date), fim: endOfDay(date) };
}

export default function AgendaPage() {
  const { eventos, loading, carregar, aplicarLocal, criar, atualizar, deletar } =
    useAgenda();

  // No celular a agenda abre na LISTA; no desktop, no mês. Enquanto a pessoa
  // não escolhe, a visão é derivada da tela — depois de escolher, a escolha
  // manda (girar o telefone não arranca ninguém de onde estava).
  const telaEstreita = useTelaEstreita();
  const expediente = useExpediente();
  const duracaoPadrao = useDuracaoPadrao();
  const [viewEscolhida, setViewEscolhida] = useState<View | null>(null);
  const view = viewEscolhida ?? (telaEstreita ? Views.AGENDA : Views.MONTH);
  const [date, setDate] = useState<Date>(new Date());

  const [formAberto, setFormAberto] = useState(false);
  const [eventoEditando, setEventoEditando] = useState<Evento | null>(null);
  const [slotInicial, setSlotInicial] = useState<{ inicio: Date; fim: Date } | null>(null);

  const [detalhe, setDetalhe] = useState<Evento | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
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
    // No mês o slot vem como dia inteiro, sem hora de término útil: aí vale a
    // duração que a empresa configurou. Na semana e no dia, o que a pessoa
    // desenhou arrastando é uma escolha explícita e manda.
    const fim =
      slot.end && slot.end > inicio
        ? (slot.end as Date)
        : addMinutes(inicio, duracaoPadrao);
    abrirNovoEvento({ inicio, fim });
  };

  /**
   * Arrastou (ou esticou) um evento no calendário.
   *
   * O evento vai para o lugar novo na hora e o PATCH confirma depois. Se
   * falhar, ele volta para onde estava — deixá-lo na posição nova seria a tela
   * mentindo que salvou.
   */
  const handleRemarcar = async ({ evento, inicio, fim, viraDiaInteiro }: Remarcacao) => {
    // Arrastar move o evento no tempo; NÃO muda a natureza dele. Virar "dia
    // inteiro" apaga o horário escolhido (o backend normaliza para 00:00–23:59)
    // e desmarcar não o traz de volta — perder isso por um arraste impreciso
    // seria caro demais. Essa troca fica no formulário, onde é deliberada.
    if (viraDiaInteiro !== evento.dia_inteiro) {
      toast.info('Para trocar "dia inteiro", edite o evento.');
      return;
    }

    const antes = { data_inicio: evento.data_inicio, data_fim: evento.data_fim };
    const novo = { data_inicio: inicio.toISOString(), data_fim: fim.toISOString() };
    if (novo.data_inicio === antes.data_inicio && novo.data_fim === antes.data_fim) {
      return; // soltou no mesmo lugar
    }

    aplicarLocal(evento.id, novo);
    try {
      // A resposta manda: o backend normaliza o dia inteiro, e o que ele
      // devolve é a verdade — não o que o calendário calculou ao soltar.
      const salvo = await atualizar(evento.id, novo);
      aplicarLocal(evento.id, salvo);
      toast.success("Evento remarcado.");
    } catch (err) {
      aplicarLocal(evento.id, antes);
      toast.error(getErrorMessage(err), { duration: 7000 });
    }
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

  const handleExcluir = () => {
    if (!detalhe) return;
    setConfirmarExclusao(true);
  };

  const handleConfirmarExclusao = async () => {
    if (!detalhe || excluindo) return; // evita duplo clique
    setExcluindo(true);
    try {
      await deletar(detalhe.id);
      toast.success("Evento excluído.");
      setConfirmarExclusao(false);
      setDetalhe(null);
      await recarregar();
    } catch (err) {
      // Erro NUNCA calado: mostra a mensagem real do backend
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-brand-accent" />
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

      {/* Tela vazia dizia nada: a grade em branco não explica o que fazer.
          A lista tem a mensagem da própria biblioteca, então aqui é só para
          as outras visões. */}
      {!loading && eventos.length === 0 && view !== Views.AGENDA && (
        <p className="text-sm text-muted-foreground">
          Nenhum evento neste período. Clique num dia para marcar o primeiro.
        </p>
      )}

      <AgendaCalendario
        eventos={eventos}
        view={view}
        date={date}
        onView={setViewEscolhida}
        onNavigate={setDate}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={setDetalhe}
        onRemarcar={handleRemarcar}
        expediente={expediente}
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

      <ConfirmDialog
        open={confirmarExclusao}
        titulo="Excluir evento"
        mensagem={
          <>
            Excluir o evento{" "}
            <span className="text-foreground font-medium">{detalhe?.titulo}</span>?
          </>
        }
        confirmLabel="Excluir"
        processando={excluindo}
        onConfirm={handleConfirmarExclusao}
        onCancel={() => setConfirmarExclusao(false)}
      />
    </div>
  );
}

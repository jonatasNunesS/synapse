"use client";
/**
 * Board Kanban da equipe (reutilizado na visão individual e na visão geral).
 * Drag-and-drop via @dnd-kit — só tarefas PESSOAIS podem ser arrastadas; tarefas
 * de projeto são read-only (arrastar mostra aviso; clicar redireciona ao projeto).
 */
import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { Plus, Calendar, AlertCircle, GripVertical, Lock } from "lucide-react";
import type { ColunaKanbanComTarefas, TarefaKanban } from "@/types/equipe";
import { PRIORIDADE_TAREFA_CORES, PRIORIDADE_TAREFA_LABELS } from "@/types/equipe";

interface BoardProps {
  colunas: ColunaKanbanComTarefas[];
  /** Mostra o avatar/iniciais do responsável no card (visão geral). */
  mostrarResponsavel?: boolean;
  /** Exibe o botão "+ Tarefa" por coluna. */
  permiteCriar?: boolean;
  onNovaTarefa?: (colunaId: string) => void;
  onAbrirTarefa: (tarefa: TarefaKanban) => void;
  onMoverPessoal?: (tarefaId: string, colunaId: string, ordem: number) => void;
}

function iniciais(nome: string): string {
  return nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function Card({
  tarefa,
  mostrarResponsavel,
  onClick,
  dragging,
}: {
  tarefa: TarefaKanban;
  mostrarResponsavel?: boolean;
  onClick: () => void;
  dragging?: boolean;
}) {
  const projeto = tarefa.origem === "projeto";
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: tarefa.id,
    data: { tarefa },
    disabled: tarefa.read_only, // tarefa de projeto não arrasta
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(projeto ? {} : listeners)}
      {...(projeto ? {} : attributes)}
      onClick={onClick}
      title={projeto ? "Mova esta tarefa no projeto" : undefined}
      className={`rounded-lg border p-3 transition-all select-none bg-slate-800/70 border-slate-700 ${
        projeto ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
      } hover:border-slate-600 ${dragging ? "opacity-40 scale-95" : ""}`}
    >
      <div className="flex items-start gap-2">
        {projeto ? (
          <Lock size={13} className="text-slate-500 mt-0.5 flex-shrink-0" />
        ) : (
          <GripVertical size={14} className="text-slate-600 mt-0.5 flex-shrink-0" />
        )}
        <p className="text-sm font-medium text-slate-100 leading-snug line-clamp-2 flex-1">
          {tarefa.titulo}
        </p>
      </div>

      {projeto && tarefa.projeto_nome && (
        <span className="inline-block mt-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300">
          Projeto {tarefa.projeto_nome}
        </span>
      )}

      <div className="flex items-center justify-between mt-2 gap-1">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            PRIORIDADE_TAREFA_CORES[tarefa.prioridade]
          }`}
        >
          {PRIORIDADE_TAREFA_LABELS[tarefa.prioridade]}
        </span>
        <div className="flex items-center gap-2">
          {tarefa.esta_atrasada && (
            <AlertCircle size={12} className="text-red-400" aria-label="Atrasada" />
          )}
          {tarefa.prazo && (
            <span
              className={`flex items-center gap-0.5 text-[11px] ${
                tarefa.esta_atrasada ? "text-red-400" : "text-slate-400"
              }`}
            >
              <Calendar size={10} />
              {new Date(tarefa.prazo).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              })}
            </span>
          )}
          {mostrarResponsavel && tarefa.responsavel && (
            <div
              className="w-5 h-5 rounded-full bg-brand-600/30 flex items-center justify-center text-brand-200 text-[10px] font-bold"
              title={tarefa.responsavel.nome}
            >
              {iniciais(tarefa.responsavel.nome)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Coluna({
  coluna,
  mostrarResponsavel,
  permiteCriar,
  onNovaTarefa,
  onAbrirTarefa,
  draggingId,
}: {
  coluna: ColunaKanbanComTarefas;
  mostrarResponsavel?: boolean;
  permiteCriar?: boolean;
  onNovaTarefa?: (colunaId: string) => void;
  onAbrirTarefa: (t: TarefaKanban) => void;
  draggingId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  return (
    <div className="flex-shrink-0 w-72 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          {coluna.cor && (
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: coluna.cor }} />
          )}
          <span className="font-semibold text-slate-200 text-sm">{coluna.nome}</span>
          <span className="bg-slate-700 text-slate-300 text-xs font-medium px-2 py-0.5 rounded-full">
            {coluna.tarefas.length}
          </span>
        </div>
        {permiteCriar && onNovaTarefa && (
          <button
            onClick={() => onNovaTarefa(coluna.id)}
            className="text-slate-400 hover:text-brand-400 transition-colors"
            title={`Nova tarefa em ${coluna.nome}`}
          >
            <Plus size={16} />
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 px-2 pb-3 pt-1 flex-1 min-h-[120px] rounded-xl border transition-colors ${
          isOver ? "bg-brand-500/10 border-brand-500/40" : "bg-slate-900/40 border-slate-800"
        }`}
      >
        {coluna.tarefas.map((t) => (
          <Card
            key={t.id}
            tarefa={t}
            mostrarResponsavel={mostrarResponsavel}
            onClick={() => onAbrirTarefa(t)}
            dragging={draggingId === t.id}
          />
        ))}
        {coluna.tarefas.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-slate-600 text-xs py-8">
            Nenhuma tarefa
          </div>
        )}
      </div>
    </div>
  );
}

export function EquipeKanbanBoard({
  colunas,
  mostrarResponsavel,
  permiteCriar,
  onNovaTarefa,
  onAbrirTarefa,
  onMoverPessoal,
}: BoardProps) {
  const [ativa, setAtiva] = useState<TarefaKanban | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleStart = (e: DragStartEvent) =>
    setAtiva((e.active.data.current?.tarefa as TarefaKanban) ?? null);

  const handleEnd = (e: DragEndEvent) => {
    const arrastada = ativa;
    setAtiva(null);
    const { over } = e;
    if (!over || !arrastada || arrastada.read_only || !onMoverPessoal) return;
    const colunaDestino = over.id as string;
    if (colunaDestino !== arrastada.coluna_id) {
      const destino = colunas.find((c) => c.id === colunaDestino);
      const ordem = destino ? destino.tarefas.length : 0;
      onMoverPessoal(arrastada.id, colunaDestino, ordem);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleStart} onDragEnd={handleEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[420px]">
        {colunas.map((coluna) => (
          <Coluna
            key={coluna.id}
            coluna={coluna}
            mostrarResponsavel={mostrarResponsavel}
            permiteCriar={permiteCriar}
            onNovaTarefa={onNovaTarefa}
            onAbrirTarefa={onAbrirTarefa}
            draggingId={ativa?.id ?? null}
          />
        ))}
        {colunas.length === 0 && (
          <p className="text-sm text-slate-500 py-10">Nenhuma coluna configurada.</p>
        )}
      </div>
      <DragOverlay>
        {ativa ? (
          <Card tarefa={ativa} mostrarResponsavel={mostrarResponsavel} onClick={() => {}} dragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

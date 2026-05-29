"use client";
/**
 * Synapse — M6: Board Kanban com drag-and-drop via @dnd-kit
 *
 * Reescrito de HTML5 nativo para @dnd-kit (R4 — Auditoria v2.0).
 * Motivo: HTML5 drag-and-drop não funciona em dispositivos móveis (touch).
 * @dnd-kit usa PointerSensor que suporta mouse E touch nativamente.
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
import {
  KANBAN_COLUMNS,
  PRIORIDADE_COLORS,
  PRIORIDADE_LABELS,
  type KanbanData,
  type TarefaList,
  type TarefaStatus,
} from "@/types/projetos";
import { Calendar, GripVertical, AlertCircle } from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface KanbanBoardProps {
  kanban: KanbanData;
  onMoverTarefa: (tarefaId: string, novoStatus: TarefaStatus, ordem: number) => Promise<void>;
  onAbrirTarefa: (tarefa: TarefaList) => void;
  onNovaTarefa: (status: TarefaStatus) => void;
}

// ── Coluna ───────────────────────────────────────────────────────────────────

function KanbanColuna({
  col,
  tarefas,
  total,
  onNovaTarefa,
  onAbrirTarefa,
  draggingId,
}: {
  col: { key: TarefaStatus; label: string; color: string };
  tarefas: TarefaList[];
  total: number;
  onNovaTarefa: (status: TarefaStatus) => void;
  onAbrirTarefa: (tarefa: TarefaList) => void;
  draggingId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });

  return (
    <div className={`flex-shrink-0 w-72 flex flex-col rounded-xl border-t-4 ${col.color} transition-colors`}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-700 text-sm">{col.label}</span>
          <span className="bg-gray-200 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
            {total}
          </span>
        </div>
        <button
          onClick={() => onNovaTarefa(col.key)}
          className="text-gray-400 hover:text-indigo-600 transition-colors text-lg leading-none"
          title={`Nova tarefa em ${col.label}`}
        >
          +
        </button>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 px-3 pb-3 flex-1 min-h-[100px] rounded-b-xl transition-colors ${
          isOver ? "bg-indigo-50" : "bg-gray-50"
        }`}
      >
        {tarefas.map((tarefa) => (
          <KanbanCard
            key={tarefa.id}
            tarefa={tarefa}
            isDragging={draggingId === tarefa.id}
            onClick={() => onAbrirTarefa(tarefa)}
          />
        ))}

        {tarefas.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-xs py-8">
            Nenhuma tarefa
          </div>
        )}
      </div>
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function KanbanCard({
  tarefa,
  isDragging,
  onClick,
}: {
  tarefa: TarefaList;
  isDragging?: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: tarefa.id,
    data: { tarefa },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-all select-none ${
        isDragging ? "opacity-40 scale-95" : ""
      }`}
    >
      {/* Grip + título */}
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="text-gray-300 mt-0.5 flex-shrink-0" />
        <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2 flex-1">
          {tarefa.titulo}
        </p>
      </div>

      {/* Tags */}
      <div className="flex items-center justify-between mt-2 gap-1">
        <span
          className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            PRIORIDADE_COLORS[tarefa.prioridade]
          }`}
        >
          {PRIORIDADE_LABELS[tarefa.prioridade]}
        </span>

        <div className="flex items-center gap-2">
          {tarefa.esta_atrasada && (
            <AlertCircle size={12} className="text-red-500" aria-label="Tarefa atrasada" />
          )}
          {tarefa.data_prazo && (
            <span
              className={`flex items-center gap-0.5 text-xs ${
                tarefa.esta_atrasada ? "text-red-500" : "text-gray-400"
              }`}
            >
              <Calendar size={10} />
              {new Date(tarefa.data_prazo).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              })}
            </span>
          )}
          {tarefa.responsavel_nome && (
            <div
              className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold"
              title={tarefa.responsavel_nome}
            >
              {tarefa.responsavel_nome.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function KanbanBoard({
  kanban,
  onMoverTarefa,
  onAbrirTarefa,
  onNovaTarefa,
}: KanbanBoardProps) {
  const [activeTarefa, setActiveTarefa] = useState<TarefaList | null>(null);

  // PointerSensor suporta mouse E touch (mobile-safe).
  // activationConstraint.distance=8 evita disparar drag em cliques simples.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTarefa(event.active.data.current?.tarefa ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTarefa(null);

    if (!over) return;

    const tarefaId = active.id as string;
    const novoStatus = over.id as TarefaStatus;

    // Encontra o status atual da tarefa
    const statusAtual = KANBAN_COLUMNS.find(({ key }) =>
      kanban[key]?.some((t: TarefaList) => t.id === tarefaId)
    )?.key;

    if (statusAtual && statusAtual !== novoStatus) {
      const ordem = kanban[novoStatus]?.length ?? 0;
      await onMoverTarefa(tarefaId, novoStatus, ordem);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColuna
            key={col.key}
            col={col}
            tarefas={kanban[col.key] ?? []}
            total={kanban.totais?.[col.key] ?? (kanban[col.key]?.length ?? 0)}
            onNovaTarefa={onNovaTarefa}
            onAbrirTarefa={onAbrirTarefa}
            draggingId={activeTarefa?.id ?? null}
          />
        ))}
      </div>

      {/* Card fantasma durante o drag */}
      <DragOverlay>
        {activeTarefa ? (
          <KanbanCard tarefa={activeTarefa} isDragging onClick={() => {}} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

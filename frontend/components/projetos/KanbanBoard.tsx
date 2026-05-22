"use client";
/**
 * Synapse — M6: Board Kanban com drag-and-drop via HTML5 API
 */
import { useCallback, useState } from "react";
import {
  KANBAN_COLUMNS,
  PRIORIDADE_COLORS,
  PRIORIDADE_LABELS,
  type KanbanData,
  type TarefaList,
  type TarefaStatus,
} from "@/types/projetos";
import { Calendar, GripVertical, AlertCircle } from "lucide-react";

interface KanbanBoardProps {
  kanban: KanbanData;
  onMoverTarefa: (tarefaId: string, novoStatus: TarefaStatus, ordem: number) => Promise<void>;
  onAbrirTarefa: (tarefa: TarefaList) => void;
  onNovaTarefa: (status: TarefaStatus) => void;
}

export function KanbanBoard({
  kanban,
  onMoverTarefa,
  onAbrirTarefa,
  onNovaTarefa,
}: KanbanBoardProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TarefaStatus | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, tarefaId: string) => {
      e.dataTransfer.setData("tarefaId", tarefaId);
      setDragging(tarefaId);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDragging(null);
    setDragOver(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, status: TarefaStatus) => {
      e.preventDefault();
      const tarefaId = e.dataTransfer.getData("tarefaId");
      if (!tarefaId) return;
      const colTarefas = kanban[status];
      await onMoverTarefa(tarefaId, status, colTarefas.length);
      setDragging(null);
      setDragOver(null);
    },
    [kanban, onMoverTarefa]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, status: TarefaStatus) => {
      e.preventDefault();
      setDragOver(status);
    },
    []
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
      {KANBAN_COLUMNS.map(({ key, label, color }) => {
        const tarefas = kanban[key] ?? [];
        const total = kanban.totais?.[key] ?? tarefas.length;
        const isOver = dragOver === key;

        return (
          <div
            key={key}
            className={`flex-shrink-0 w-72 flex flex-col rounded-xl border-t-4 bg-gray-50 ${color} transition-colors ${
              isOver ? "bg-indigo-50" : ""
            }`}
            onDrop={(e) => handleDrop(e, key)}
            onDragOver={(e) => handleDragOver(e, key)}
            onDragLeave={() => setDragOver(null)}
          >
            {/* Cabeçalho da coluna */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700 text-sm">{label}</span>
                <span className="bg-gray-200 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                  {total}
                </span>
              </div>
              <button
                onClick={() => onNovaTarefa(key)}
                className="text-gray-400 hover:text-indigo-600 transition-colors text-lg leading-none"
                title={`Nova tarefa em ${label}`}
              >
                +
              </button>
            </div>

            {/* Tarefas */}
            <div className="flex flex-col gap-2 px-3 pb-3 flex-1 min-h-[100px]">
              {tarefas.map((tarefa) => (
                <KanbanCard
                  key={tarefa.id}
                  tarefa={tarefa}
                  isDragging={dragging === tarefa.id}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
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
      })}
    </div>
  );
}

// ── Card de Tarefa no Kanban ──────────────────────────────

interface KanbanCardProps {
  tarefa: TarefaList;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

function KanbanCard({
  tarefa,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: KanbanCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, tarefa.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-sm transition-all select-none ${
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

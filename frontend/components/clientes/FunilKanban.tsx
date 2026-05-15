"use client";

import { useState } from "react";
import Link from "next/link";
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
import { MessageCircle, AlertCircle, DollarSign } from "lucide-react";
import type { ClienteList, StatusFunil, FunilData } from "@/types/clientes";
import { STATUS_FUNIL_LABELS, STATUS_FUNIL_COLORS } from "@/types/clientes";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface FunilKanbanProps {
  funil: FunilData | null;
  loading?: boolean;
  onMover?: (clienteId: string, novoStatus: StatusFunil) => void;
}

// ─── Coluna ───────────────────────────────────────────────────────────────────

function KanbanColuna({
  status,
  clientes,
  totais,
}: {
  status: StatusFunil;
  clientes: ClienteList[];
  totais: { count: number; valor_total: string };
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const valorTotal = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
  }).format(parseFloat(totais.valor_total || "0"));

  return (
    <div className="flex flex-col min-w-[220px] w-full">
      {/* Header da coluna */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${STATUS_FUNIL_COLORS[status]}`}
          />
          <span className="text-sm font-medium text-white">
            {STATUS_FUNIL_LABELS[status]}
          </span>
          <span className="text-xs text-gray-500 bg-white/5 px-1.5 py-0.5 rounded-full">
            {totais.count}
          </span>
        </div>
        {parseFloat(totais.valor_total || "0") > 0 && (
          <span className="text-xs text-gray-400">{valorTotal}</span>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] rounded-xl p-2 transition-colors ${
          isOver ? "bg-purple-500/10 border border-purple-500/30" : "bg-white/3 border border-white/5"
        }`}
      >
        <div className="flex flex-col gap-2">
          {clientes.map((cliente) => (
            <KanbanCard key={cliente.id} cliente={cliente} />
          ))}
          {clientes.length === 0 && (
            <div className="flex items-center justify-center h-20 text-xs text-gray-600">
              Arraste clientes aqui
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function KanbanCard({ cliente, isDragging }: { cliente: ClienteList; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: cliente.id,
    data: { cliente },
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
      className={`bg-[#0f1117] border border-white/10 rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all select-none ${
        isDragging ? "opacity-50 shadow-2xl scale-105" : "hover:border-white/20"
      }`}
    >
      {/* Nome */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-400 text-xs font-semibold flex-shrink-0">
          {cliente.nome.charAt(0).toUpperCase()}
        </div>
        <Link
          href={`/clientes/${cliente.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-medium text-white hover:text-purple-400 transition-colors truncate"
        >
          {cliente.nome}
        </Link>
      </div>

      {/* Info */}
      <div className="space-y-1">
        {cliente.origem_display && (
          <p className="text-xs text-gray-500">{cliente.origem_display}</p>
        )}

        {parseFloat(cliente.valor_total_compras) > 0 && (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <DollarSign className="w-3 h-3" />
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(parseFloat(cliente.valor_total_compras))}
          </div>
        )}

        {cliente.followup_atrasado && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="w-3 h-3" />
            Follow-up atrasado
          </div>
        )}

        {cliente.proximo_followup && !cliente.followup_atrasado && (
          <div className="text-xs text-yellow-400">
            Follow-up: {new Date(cliente.proximo_followup).toLocaleDateString("pt-BR")}
          </div>
        )}
      </div>

      {/* Footer */}
      {cliente.link_whatsapp && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <a
            href={cliente.link_whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
          >
            <MessageCircle className="w-3 h-3" />
            WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const COLUNAS: StatusFunil[] = ["lead", "contato", "proposta", "negociacao", "fechado", "perdido"];

export function FunilKanban({ funil, loading, onMover }: FunilKanbanProps) {
  const [activeCliente, setActiveCliente] = useState<ClienteList | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveCliente(active.data.current?.cliente ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCliente(null);

    if (!over || !funil) return;

    const clienteId = active.id as string;
    const novoStatus = over.id as StatusFunil;

    // Verifica se o status mudou
    const statusAtual = COLUNAS.find((s) =>
      funil[s]?.some?.((c: ClienteList) => c.id === clienteId)
    );

    if (statusAtual && statusAtual !== novoStatus) {
      onMover?.(clienteId, novoStatus);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {COLUNAS.map((s) => (
          <div key={s} className="space-y-3">
            <div className="h-6 bg-white/5 rounded animate-pulse" />
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!funil) return null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {COLUNAS.map((status) => (
          <KanbanColuna
            key={status}
            status={status}
            clientes={funil[status] ?? []}
            totais={funil.totais?.[status] ?? { count: 0, valor_total: "0" }}
          />
        ))}
      </div>

      {/* Drag overlay — card fantasma durante o drag */}
      <DragOverlay>
        {activeCliente ? (
          <KanbanCard cliente={activeCliente} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

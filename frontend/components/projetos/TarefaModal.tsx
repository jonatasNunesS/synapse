"use client";
/**
 * Synapse — M6: Modal de detalhe da Tarefa (comentários + checklist)
 */
import { useState } from "react";
import { X, Send, CheckSquare, Square, Trash2, Pencil } from "lucide-react";
import type { TarefaDetail } from "@/types/projetos";
import {
  PRIORIDADE_COLORS,
  PRIORIDADE_LABELS,
  TAREFA_STATUS_COLORS,
  TAREFA_STATUS_LABELS,
} from "@/types/projetos";
import { useComentarios, useChecklist } from "@/hooks/useProjetos";

interface TarefaModalProps {
  tarefa: TarefaDetail;
  onFechar: () => void;
  onEditar: () => void;
  onRecarregar: () => void;
}

export function TarefaModal({ tarefa, onFechar, onEditar, onRecarregar }: TarefaModalProps) {
  const { comentarios, adicionar: adicionarComentario, deletar: deletarComentario } =
    useComentarios(tarefa.id);
  const { toggle: toggleItem, deletar: deletarItem, adicionar: adicionarItem } =
    useChecklist(tarefa.id);

  const [novoComentario, setNovoComentario] = useState("");
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [novoItem, setNovoItem] = useState("");
  const [checklist, setChecklist] = useState(tarefa.checklist ?? []);

  const handleEnviarComentario = async () => {
    if (!novoComentario.trim()) return;
    setEnviandoComentario(true);
    try {
      await adicionarComentario(novoComentario.trim());
      setNovoComentario("");
    } finally {
      setEnviandoComentario(false);
    }
  };

  const handleToggleItem = async (itemId: string) => {
    const updated = await toggleItem(itemId);
    setChecklist((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, concluido: updated.concluido } : i))
    );
    onRecarregar();
  };

  const handleAdicionarItem = async () => {
    if (!novoItem.trim()) return;
    const item = await adicionarItem(novoItem.trim(), checklist.length);
    setChecklist((prev) => [...prev, item]);
    setNovoItem("");
    onRecarregar();
  };

  const handleDeletarItem = async (itemId: string) => {
    await deletarItem(itemId);
    setChecklist((prev) => prev.filter((i) => i.id !== itemId));
    onRecarregar();
  };

  const concluidos = checklist.filter((i) => i.concluido).length;
  const progressoChecklist = checklist.length > 0
    ? Math.round((concluidos / checklist.length) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 leading-snug">
              {tarefa.titulo}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  TAREFA_STATUS_COLORS[tarefa.status]
                }`}
              >
                {TAREFA_STATUS_LABELS[tarefa.status]}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  PRIORIDADE_COLORS[tarefa.prioridade]
                }`}
              >
                {PRIORIDADE_LABELS[tarefa.prioridade]}
              </span>
              {tarefa.esta_atrasada && (
                <span className="text-xs text-red-600 font-medium">⚠ Atrasada</span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={onEditar}
              className="text-gray-400 hover:text-indigo-600 transition-colors p-1"
              title="Editar tarefa"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={onFechar}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Descrição */}
          {tarefa.descricao && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Descrição
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{tarefa.descricao}</p>
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {tarefa.responsavel_nome && (
              <div>
                <span className="text-xs text-gray-500">Responsável</span>
                <p className="font-medium text-gray-800">{tarefa.responsavel_nome}</p>
              </div>
            )}
            {tarefa.data_prazo && (
              <div>
                <span className="text-xs text-gray-500">Prazo</span>
                <p className={`font-medium ${tarefa.esta_atrasada ? "text-red-600" : "text-gray-800"}`}>
                  {new Date(tarefa.data_prazo).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}
            {tarefa.estimativa_horas && (
              <div>
                <span className="text-xs text-gray-500">Estimativa</span>
                <p className="font-medium text-gray-800">{tarefa.estimativa_horas}h</p>
              </div>
            )}
            {tarefa.horas_gastas && tarefa.horas_gastas !== "0.00" && (
              <div>
                <span className="text-xs text-gray-500">Horas Gastas</span>
                <p className="font-medium text-gray-800">{tarefa.horas_gastas}h</p>
              </div>
            )}
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Checklist
              </h3>
              {checklist.length > 0 && (
                <span className="text-xs text-gray-500">
                  {concluidos}/{checklist.length} ({progressoChecklist}%)
                </span>
              )}
            </div>
            {checklist.length > 0 && (
              <div className="w-full bg-gray-100 rounded-full h-1 mb-3">
                <div
                  className="h-1 rounded-full bg-green-500 transition-all"
                  style={{ width: `${progressoChecklist}%` }}
                />
              </div>
            )}
            <div className="space-y-1.5">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => handleToggleItem(item.id)}
                    className="text-gray-400 hover:text-green-600 transition-colors flex-shrink-0"
                  >
                    {item.concluido ? (
                      <CheckSquare size={16} className="text-green-500" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                  <span
                    className={`text-sm flex-1 ${
                      item.concluido ? "line-through text-gray-400" : "text-gray-700"
                    }`}
                  >
                    {item.texto}
                  </span>
                  <button
                    onClick={() => handleDeletarItem(item.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            {/* Novo item */}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdicionarItem()}
                placeholder="Adicionar item..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={handleAdicionarItem}
                className="text-sm text-indigo-600 font-medium hover:text-indigo-700 px-2"
              >
                Adicionar
              </button>
            </div>
          </div>

          {/* Comentários */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Comentários ({comentarios.length})
            </h3>
            <div className="space-y-3 mb-3">
              {comentarios.map((com) => (
                <div key={com.id} className="flex gap-3 group">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                    {com.autor_nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700">
                        {com.autor_nome}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(com.criado_em).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {com.editado && (
                        <span className="text-xs text-gray-400 italic">(editado)</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">
                      {com.texto}
                    </p>
                  </div>
                  <button
                    onClick={() => deletarComentario(com.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Input comentário */}
            <div className="flex gap-2">
              <input
                type="text"
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEnviarComentario()}
                placeholder="Escreva um comentário..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleEnviarComentario}
                disabled={enviandoComentario || !novoComentario.trim()}
                className="bg-indigo-600 text-white rounded-lg px-3 py-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

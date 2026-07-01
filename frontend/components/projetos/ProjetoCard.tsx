"use client";
/**
 * Synapse — M6: Card de Projeto para listagem
 * Bug D: corrigido dark mode — removidas classes bg-white, text-gray-*, border-gray-*
 */
import { Calendar, Clock, Users } from "lucide-react";
import Link from "next/link";
import {
  PRIORIDADE_COLORS,
  PRIORIDADE_LABELS,
  PROJETO_STATUS_COLORS,
  PROJETO_STATUS_LABELS,
  type ProjetoList,
} from "@/types/projetos";

interface ProjetoCardProps {
  projeto: ProjetoList;
  onEditar?: (projeto: ProjetoList) => void;
  onDeletar?: (id: string) => void;
}

export function ProjetoCard({ projeto, onEditar, onDeletar }: ProjetoCardProps) {
  const progresso = projeto.progresso ?? 0;

  return (
    <div className="bg-[#0d1117] border border-white/10 rounded-xl p-5 hover:border-white/20 hover:shadow-lg transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: projeto.cor || "#6366f1" }}
          />
          <Link
            href={`/projetos/${projeto.id}`}
            className="font-semibold text-white truncate hover:text-indigo-400 transition-colors"
          >
            {projeto.nome}
          </Link>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROJETO_STATUS_COLORS[projeto.status]}`}
          >
            {PROJETO_STATUS_LABELS[projeto.status]}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORIDADE_COLORS[projeto.prioridade]}`}
          >
            {PRIORIDADE_LABELS[projeto.prioridade]}
          </span>
        </div>
      </div>

      {/* Progresso */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Progresso</span>
          <span>{progresso}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{
              width: `${progresso}%`,
              backgroundColor: projeto.cor || "#6366f1",
            }}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          {projeto.responsavel_nome && (
            <span className="flex items-center gap-1">
              <Users size={12} />
              {projeto.responsavel_nome}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {projeto.total_tarefas} tarefa{projeto.total_tarefas !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {projeto.data_prazo && (
            <span
              className={`flex items-center gap-1 ${
                projeto.esta_atrasado ? "text-red-400 font-medium" : ""
              }`}
            >
              <Calendar size={12} />
              {new Date(projeto.data_prazo).toLocaleDateString("pt-BR")}
              {projeto.esta_atrasado && " ⚠"}
            </span>
          )}
          {(onEditar || onDeletar) && (
            <div className="flex gap-1 ml-2">
              {onEditar && (
                <button
                  onClick={() => onEditar(projeto)}
                  className="text-slate-500 hover:text-indigo-400 transition-colors p-0.5"
                  title="Editar"
                >
                  ✏
                </button>
              )}
              {onDeletar && (
                <button
                  onClick={() => onDeletar(projeto.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors p-0.5"
                  title="Excluir"
                >
                  🗑
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

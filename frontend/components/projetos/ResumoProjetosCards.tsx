"use client";
/**
 * Synapse — M6: Cards de Resumo de Projetos
 */
import { FolderOpen, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { ResumoProjetosData } from "@/types/projetos";

interface ResumoProjetosCardsProps {
  resumo: ResumoProjetosData;
}

export function ResumoProjetosCards({ resumo }: ResumoProjetosCardsProps) {
  const cards = [
    {
      label: "Projetos Ativos",
      valor: resumo.projetos_ativos,
      total: resumo.total_projetos,
      icon: FolderOpen,
      cor: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "Projetos Atrasados",
      valor: resumo.projetos_atrasados,
      icon: AlertCircle,
      cor: "text-red-600",
      bg: "bg-red-50",
      alerta: resumo.projetos_atrasados > 0,
    },
    {
      label: "Tarefas Pendentes",
      valor: resumo.tarefas_pendentes,
      icon: Clock,
      cor: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "Minhas Tarefas",
      valor: resumo.tarefas_minhas,
      icon: CheckCircle2,
      cor: "text-green-600",
      bg: "bg-green-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, valor, total, icon: Icon, cor, bg, alerta }) => (
        <div
          key={label}
          className={`bg-white rounded-xl border p-4 ${
            alerta ? "border-red-200" : "border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">{label}</span>
            <div className={`${bg} p-1.5 rounded-lg`}>
              <Icon size={14} className={cor} />
            </div>
          </div>
          <div className="flex items-end gap-1">
            <span className={`text-2xl font-bold ${alerta ? "text-red-600" : "text-gray-900"}`}>
              {valor}
            </span>
            {total !== undefined && (
              <span className="text-sm text-gray-400 mb-0.5">/ {total}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

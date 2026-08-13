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
      cor: "text-brand-accent",
      bg: "bg-brand-500/10",
    },
    {
      label: "Projetos Atrasados",
      valor: resumo.projetos_atrasados,
      icon: AlertCircle,
      cor: "text-erro",
      bg: "bg-erro/10",
      alerta: resumo.projetos_atrasados > 0,
    },
    {
      label: "Tarefas Pendentes",
      valor: resumo.tarefas_pendentes,
      icon: Clock,
      cor: "text-alerta",
      bg: "bg-alerta/10",
    },
    {
      label: "Minhas Tarefas",
      valor: resumo.tarefas_minhas,
      icon: CheckCircle2,
      cor: "text-sucesso",
      bg: "bg-sucesso/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, valor, total, icon: Icon, cor, bg, alerta }) => (
        <div
          key={label}
          className={`bg-card rounded-xl border p-4 ${
            alerta ? "border-erro/30" : "border-border"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-suave">{label}</span>
            <div className={`${bg} p-1.5 rounded-lg`}>
              <Icon size={14} className={cor} />
            </div>
          </div>
          <div className="flex items-end gap-1">
            <span className={`text-2xl font-bold ${alerta ? "text-erro" : "text-foreground"}`}>
              {valor}
            </span>
            {total !== undefined && (
              <span className="text-sm text-muted-foreground mb-0.5">/ {total}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

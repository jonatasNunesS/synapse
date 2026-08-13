"use client";

import { Users, UserCheck, UserX, Target, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useResumoEquipe } from "@/hooks/useEquipe";

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ResumoEquipeCards() {
  const { resumo, isLoading } = useResumoEquipe();

  if (isLoading || !resumo) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-12 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const taxaMetas =
    resumo.metas_ativas > 0
      ? Math.round((resumo.metas_atingidas / resumo.metas_ativas) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatCard
        icon={Users}
        label="Total de Membros"
        value={resumo.total_membros}
        color="bg-brand-500/15 text-brand-accent dark:bg-brand-900/30 dark:text-brand-accent"
      />
      <StatCard
        icon={UserCheck}
        label="Ativos"
        value={resumo.membros_ativos}
        color="bg-sucesso/10 text-sucesso dark:bg-green-900/30 dark:text-sucesso"
      />
      <StatCard
        icon={UserX}
        label="Inativos"
        value={resumo.membros_inativos}
        color="bg-muted text-muted-foreground dark:bg-secondary dark:text-muted-foreground"
      />
      <StatCard
        icon={Target}
        label="Metas Ativas"
        value={resumo.metas_ativas}
        color="bg-info/10 text-info dark:bg-blue-900/30 dark:text-info"
      />
      <StatCard
        icon={Trophy}
        label="Metas Atingidas"
        value={`${resumo.metas_atingidas} (${taxaMetas}%)`}
        color="bg-alerta/10 text-alerta dark:bg-amber-900/30 dark:text-alerta"
      />
    </div>
  );
}

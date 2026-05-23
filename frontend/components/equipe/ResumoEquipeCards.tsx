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
        color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
      />
      <StatCard
        icon={UserCheck}
        label="Ativos"
        value={resumo.membros_ativos}
        color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
      />
      <StatCard
        icon={UserX}
        label="Inativos"
        value={resumo.membros_inativos}
        color="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
      />
      <StatCard
        icon={Target}
        label="Metas Ativas"
        value={resumo.metas_ativas}
        color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
      />
      <StatCard
        icon={Trophy}
        label="Metas Atingidas"
        value={`${resumo.metas_atingidas} (${taxaMetas}%)`}
        color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
      />
    </div>
  );
}

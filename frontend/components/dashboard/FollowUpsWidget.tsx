"use client";

import Link from "next/link";
import { Users, Phone, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FollowUpItem } from "@/types/dashboard";
import { STATUS_FUNIL_LABELS, STATUS_FUNIL_CORES } from "@/types/dashboard";

interface FollowUpsWidgetProps {
  followups: FollowUpItem[];
  isLoading: boolean;
}

const formatDate = (dateStr: string) => {
  const [ano, mes, dia] = dateStr.split("-");
  return `${dia}/${mes}`;
};

export function FollowUpsWidget({ followups, isLoading }: FollowUpsWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4 text-purple-500" />
            Follow-ups Próximos
          </CardTitle>
          <Link
            href="/clientes"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {followups.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            Nenhum follow-up agendado para os próximos 3 dias.
          </div>
        ) : (
          <div className="space-y-2">
            {followups.slice(0, 5).map((f) => (
              <Link
                key={f.id}
                href={`/clientes/${f.id}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors group"
              >
                {/* Avatar */}
                <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-purple-700">
                    {f.nome.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-foreground">
                    {f.nome}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: `${STATUS_FUNIL_CORES[f.status_funil]}20`,
                        color: STATUS_FUNIL_CORES[f.status_funil],
                      }}
                    >
                      {STATUS_FUNIL_LABELS[f.status_funil] ?? f.status_funil}
                    </span>
                  </div>
                </div>

                {/* Data */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-medium ${f.dias_restantes === 0 ? "text-red-500" : f.dias_restantes === 1 ? "text-orange-500" : "text-foreground"}`}>
                    {formatDate(f.proximo_followup)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {f.dias_restantes === 0 ? "Hoje" : f.dias_restantes === 1 ? "Amanhã" : `${f.dias_restantes}d`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

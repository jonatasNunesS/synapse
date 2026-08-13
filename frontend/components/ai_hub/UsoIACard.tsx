"use client";

import { Zap, TrendingUp, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { UsoIA } from "@/types/ai_hub";

interface UsoIACardProps {
  uso: UsoIA | null;
}

const PLANO_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

const PLANO_CORES: Record<string, string> = {
  starter: "bg-muted text-foreground-suave",
  pro: "bg-info/10 text-info",
  business: "bg-brand-500/15 text-brand-accent",
  enterprise: "bg-alerta/10 text-alerta",
};

export function UsoIACard({ uso }: UsoIACardProps) {
  if (!uso) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-4 bg-muted rounded w-3/4 mb-3" />
          <div className="h-2 bg-muted rounded w-full mb-2" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </CardContent>
      </Card>
    );
  }

  const percentual = uso.ilimitado ? 0 : Math.min(uso.percentual, 100);
  const corBarra =
    percentual >= 90
      ? "bg-red-500"
      : percentual >= 70
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-alerta" />
            Uso de IA este mês
          </CardTitle>
          <Badge className={PLANO_CORES[uso.plano] || "bg-muted text-foreground-suave"}>
            <Crown className="h-3 w-3 mr-1" />
            {PLANO_LABELS[uso.plano] || uso.plano}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {uso.ilimitado ? (
          <div className="flex items-center gap-2 text-sucesso">
            <TrendingUp className="h-5 w-5" />
            <span className="text-2xl font-bold">{uso.usado}</span>
            <span className="text-sm text-muted-suave">gerações (ilimitado)</span>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-2xl font-bold text-foreground">{uso.usado}</span>
              <span className="text-muted-foreground mb-0.5">/ {uso.limite}</span>
              <span className="text-sm text-muted-suave mb-0.5 ml-1">gerações</span>
            </div>
            {/* Barra de progresso */}
            <div className="w-full bg-muted rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full transition-all ${corBarra}`}
                style={{ width: `${percentual}%` }}
              />
            </div>
            <p className="text-xs text-muted-suave">
              Renova em{" "}
              {new Date(uso.resetar_em).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
              })}
              {percentual >= 90 && (
                <span className="text-erro font-medium ml-2">
                  — Limite quase atingido
                </span>
              )}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

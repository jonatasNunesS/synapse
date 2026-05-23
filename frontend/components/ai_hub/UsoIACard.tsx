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
  starter: "bg-slate-100 text-slate-700",
  pro: "bg-blue-100 text-blue-700",
  business: "bg-purple-100 text-purple-700",
  enterprise: "bg-amber-100 text-amber-700",
};

export function UsoIACard({ uso }: UsoIACardProps) {
  if (!uso) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
          <div className="h-2 bg-slate-200 rounded w-full mb-2" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
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
          <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Uso de IA este mês
          </CardTitle>
          <Badge className={PLANO_CORES[uso.plano] || "bg-slate-100 text-slate-700"}>
            <Crown className="h-3 w-3 mr-1" />
            {PLANO_LABELS[uso.plano] || uso.plano}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {uso.ilimitado ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <TrendingUp className="h-5 w-5" />
            <span className="text-2xl font-bold">{uso.usado}</span>
            <span className="text-sm text-slate-500">gerações (ilimitado)</span>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-2xl font-bold text-slate-900">{uso.usado}</span>
              <span className="text-slate-400 mb-0.5">/ {uso.limite}</span>
              <span className="text-sm text-slate-500 mb-0.5 ml-1">gerações</span>
            </div>
            {/* Barra de progresso */}
            <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full transition-all ${corBarra}`}
                style={{ width: `${percentual}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              Renova em{" "}
              {new Date(uso.resetar_em).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
              })}
              {percentual >= 90 && (
                <span className="text-red-500 font-medium ml-2">
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

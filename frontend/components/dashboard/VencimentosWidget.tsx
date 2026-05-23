"use client";

import Link from "next/link";
import { DollarSign, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { VencimentoItem } from "@/types/dashboard";

interface VencimentosWidgetProps {
  vencimentos: VencimentoItem[];
  isLoading: boolean;
}

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (dateStr: string) => {
  const [ano, mes, dia] = dateStr.split("-");
  return `${dia}/${mes}/${ano}`;
};

export function VencimentosWidget({ vencimentos, isLoading }: VencimentosWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
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
            <DollarSign className="h-4 w-4 text-yellow-500" />
            Vencimentos Próximos
          </CardTitle>
          <Link
            href="/financeiro"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {vencimentos.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            Nenhum vencimento nos próximos 7 dias.
          </div>
        ) : (
          <div className="space-y-2">
            {vencimentos.slice(0, 5).map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors"
              >
                {/* Ícone de tipo */}
                <div className={`p-1.5 rounded-md flex-shrink-0 ${v.tipo === "receita" ? "bg-green-50" : "bg-red-50"}`}>
                  {v.tipo === "receita" ? (
                    <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                  )}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(v.data_vencimento)}
                    {v.dias_restantes === 0 ? (
                      <span className="text-red-500 ml-1">· Hoje</span>
                    ) : v.dias_restantes === 1 ? (
                      <span className="text-orange-500 ml-1">· Amanhã</span>
                    ) : (
                      <span className="ml-1">· em {v.dias_restantes} dias</span>
                    )}
                  </p>
                </div>

                {/* Valor */}
                <span className={`text-sm font-semibold flex-shrink-0 ${v.tipo === "receita" ? "text-green-600" : "text-red-600"}`}>
                  {v.tipo === "receita" ? "+" : "-"}
                  {formatCurrency(v.valor)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

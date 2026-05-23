"use client";

import Link from "next/link";
import { Package, AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AlertaEstoqueItem } from "@/types/dashboard";
import { ALERTA_ESTOQUE_LABELS, ALERTA_ESTOQUE_CORES } from "@/types/dashboard";

interface AlertasEstoqueWidgetProps {
  alertas: AlertaEstoqueItem[];
  isLoading: boolean;
}

export function AlertasEstoqueWidget({ alertas, isLoading }: AlertasEstoqueWidgetProps) {
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
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Alertas de Estoque
            {alertas.length > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                {alertas.length}
              </span>
            )}
          </CardTitle>
          <Link
            href="/estoque"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            Ver estoque <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {alertas.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            <Package className="h-8 w-8 mx-auto mb-2 text-green-500" />
            Estoque saudável! Nenhum alerta.
          </div>
        ) : (
          <div className="space-y-2">
            {alertas.slice(0, 6).map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors"
              >
                {/* Ícone */}
                <div
                  className="p-1.5 rounded-md flex-shrink-0"
                  style={{ backgroundColor: `${ALERTA_ESTOQUE_CORES[a.status_estoque]}15` }}
                >
                  <Package
                    className="h-3.5 w-3.5"
                    style={{ color: ALERTA_ESTOQUE_CORES[a.status_estoque] }}
                  />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    SKU: {a.sku}
                  </p>
                </div>

                {/* Status e estoque */}
                <div className="text-right flex-shrink-0">
                  <span
                    className="text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `${ALERTA_ESTOQUE_CORES[a.status_estoque]}15`,
                      color: ALERTA_ESTOQUE_CORES[a.status_estoque],
                    }}
                  >
                    {ALERTA_ESTOQUE_LABELS[a.status_estoque]}
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {Number(a.estoque_atual).toFixed(0)}/{Number(a.estoque_minimo).toFixed(0)} {a.unidade}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FunilEtapa } from "@/types/dashboard";
import { STATUS_FUNIL_CORES, STATUS_FUNIL_LABELS } from "@/types/dashboard";

interface FunilWidgetProps {
  etapas: FunilEtapa[];
  isLoading: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as FunilEtapa;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-foreground">{d.label}</p>
      <p className="text-muted-foreground mt-1">
        {d.count} cliente{d.count !== 1 ? "s" : ""}
      </p>
      {d.valor_total > 0 && (
        <p className="text-muted-foreground">
          {d.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </p>
      )}
      <p className="text-muted-foreground">{d.percentual.toFixed(1)}% do total</p>
    </div>
  );
};

export function FunilWidget({ etapas, isLoading }: FunilWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[220px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const dados = etapas.map((e) => ({
    ...e,
    label: STATUS_FUNIL_LABELS[e.status] ?? e.status,
    cor: STATUS_FUNIL_CORES[e.status] ?? "#6b7280",
  }));

  const totalClientes = etapas.reduce((acc, e) => acc + e.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Funil de Vendas</CardTitle>
          <span className="text-sm text-muted-foreground">{totalClientes} clientes</span>
        </div>
      </CardHeader>
      <CardContent>
        {totalClientes === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhum cliente cadastrado ainda.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dados} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Clientes" radius={[4, 4, 0, 0]}>
                {dados.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.cor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

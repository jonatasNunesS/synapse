"use client";

import { Bell, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardResumo } from "@/types/dashboard";

interface BoasVindasCardProps {
  resumo: DashboardResumo | undefined;
  nomeUsuario: string;
  isLoading?: boolean;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function getSaudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export function BoasVindasCard({ resumo, nomeUsuario, isLoading }: BoasVindasCardProps) {
  const saudacao = getSaudacao();
  const primeiroNome = nomeUsuario.split(" ")[0];
  const mes = resumo ? MESES[resumo.meta.mes - 1] : MESES[new Date().getMonth()];
  const ano = resumo?.meta.ano ?? new Date().getFullYear();
  const naoLidas = resumo?.notificacoes.nao_lidas ?? 0;
  const saldoMes = resumo?.financeiro.saldo_mes ?? 0;
  const saldoPositivo = saldoMes >= 0;

  return (
    <Card className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white border-0 shadow-lg">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Saudação */}
          <div>
            <p className="text-indigo-200 text-sm font-medium">{saudacao},</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">
              {isLoading ? "..." : primeiroNome} 👋
            </h1>
            <p className="text-indigo-200 text-sm mt-1">
              Resumo de {mes} de {ano}
            </p>
          </div>

          {/* Indicadores rápidos */}
          <div className="flex flex-wrap gap-2">
            {/* Saldo do mês */}
            {!isLoading && (
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-2">
                <TrendingUp className={`h-4 w-4 ${saldoPositivo ? "text-green-300" : "text-red-300"}`} />
                <div>
                  <p className="text-xs text-indigo-200">Saldo do mês</p>
                  <p className={`text-sm font-bold ${saldoPositivo ? "text-green-300" : "text-red-300"}`}>
                    {saldoPositivo ? "+" : ""}
                    {saldoMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>
              </div>
            )}

            {/* Notificações */}
            {!isLoading && naoLidas > 0 && (
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-2">
                <Bell className="h-4 w-4 text-yellow-300" />
                <div>
                  <p className="text-xs text-indigo-200">Notificações</p>
                  <p className="text-sm font-bold text-yellow-300">
                    {naoLidas} nova{naoLidas !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            )}

            {/* Tarefas pendentes */}
            {!isLoading && (resumo?.projetos.tarefas_minhas ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-2">
                <div>
                  <p className="text-xs text-indigo-200">Minhas tarefas</p>
                  <p className="text-sm font-bold text-white">
                    {resumo?.projetos.tarefas_minhas} pendente{resumo?.projetos.tarefas_minhas !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LayoutDashboard,
  DollarSign,
  Package,
  Users,
  Truck,
  FolderKanban,
  Sparkles,
  CheckCircle2,
  Circle,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

interface HealthStatus {
  status: string;
  service: string;
}

interface Milestone {
  id: string;
  label: string;
  icon: React.ElementType;
  status: "done" | "current" | "upcoming";
}

/* eslint-disable @typescript-eslint/no-unused-vars */

const milestones: Milestone[] = [
  { id: "M0", label: "Fundação", icon: LayoutDashboard, status: "current" },
  { id: "M1", label: "Autenticação", icon: LayoutDashboard, status: "upcoming" },
  { id: "M2", label: "Financeiro", icon: DollarSign, status: "upcoming" },
  { id: "M3", label: "Estoque", icon: Package, status: "upcoming" },
  { id: "M4", label: "CRM Clientes", icon: Users, status: "upcoming" },
  { id: "M5", label: "Fornecedores", icon: Truck, status: "upcoming" },
  { id: "M6", label: "Projetos", icon: FolderKanban, status: "upcoming" },
  { id: "M7", label: "Equipe + Docs", icon: LayoutDashboard, status: "upcoming" },
  { id: "M8", label: "Dashboard", icon: LayoutDashboard, status: "upcoming" },
  { id: "M9", label: "AI Hub", icon: Sparkles, status: "upcoming" },
];

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await api.get<HealthStatus>("/health/");
        setHealth(response.data);
        setHealthError(false);
      } catch {
        setHealthError(true);
      }
    };
    checkHealth();
  }, []);

  return (
    <div className="space-y-8">
      {/* ── Cabeçalho ─────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Bem-vindo ao Synapse. Seu sistema de gestão empresarial com IA.
        </p>
      </div>

      {/* ── Status da API ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status do Sistema</CardTitle>
          <CardDescription>Verificação de saúde dos serviços</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-3 w-3 rounded-full",
                health ? "bg-emerald-500 animate-pulse" : healthError ? "bg-destructive" : "bg-muted"
              )}
            />
            <span className="text-sm text-foreground">
              {health
                ? `API operacional (${health.service})`
                : healthError
                ? "API indisponível - verifique se o backend está rodando"
                : "Verificando..."}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Roadmap de Milestones ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Roadmap de Desenvolvimento</CardTitle>
          <CardDescription>Progresso dos milestones do Synapse</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {milestones.map((milestone) => {
              return (
                <div key={milestone.id} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                      milestone.status === "done" && "bg-emerald-500/20 text-emerald-500",
                      milestone.status === "current" && "bg-primary/20 text-primary",
                      milestone.status === "upcoming" && "bg-muted text-muted-foreground"
                    )}
                  >
                    {milestone.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : milestone.status === "current" ? (
                      <ArrowRight className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        milestone.status === "done" && "text-emerald-500",
                        milestone.status === "current" && "text-primary",
                        milestone.status === "upcoming" && "text-muted-foreground"
                      )}
                    >
                      {milestone.id} — {milestone.label}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      milestone.status === "done" && "bg-emerald-500/10 text-emerald-500",
                      milestone.status === "current" && "bg-primary/10 text-primary",
                      milestone.status === "upcoming" && "bg-muted text-muted-foreground"
                    )}
                  >
                    {milestone.status === "done"
                      ? "Concluído"
                      : milestone.status === "current"
                      ? "Em progresso"
                      : "Pendente"}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import Link from "next/link";
import { UserCog, Mail, Briefcase, Building2, Target, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MembroEquipe } from "@/types/equipe";

interface MembroCardProps {
  membro: MembroEquipe;
  onEditar: (membro: MembroEquipe) => void;
  onRemover: (id: string) => void;
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="w-full bg-muted rounded-full h-1.5">
      <div
        className="h-1.5 rounded-full bg-violet-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function MembroCard({ membro, onEditar, onRemover }: MembroCardProps) {
  const iniciais = membro.nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const taxaAtingimento =
    membro.total_metas > 0
      ? Math.round((membro.metas_atingidas / membro.total_metas) * 100)
      : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Avatar + Info */}
          <Link href={`/equipe/${membro.id}`} className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/20 text-violet-400 text-sm font-bold border border-violet-600/30 flex-shrink-0">
              {iniciais}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{membro.nome}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{membro.email}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {membro.cargo && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Briefcase className="h-3 w-3" />
                    <span>{membro.cargo}</span>
                  </div>
                )}
                {membro.departamento && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    <span>{membro.departamento}</span>
                  </div>
                )}
              </div>
            </div>
          </Link>

          {/* Ações */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={membro.ativo ? "default" : "secondary"} className="text-xs">
              {membro.ativo ? "Ativo" : "Inativo"}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditar(membro)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onRemover(membro.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Metas */}
        {membro.total_metas > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Target className="h-3 w-3" />
                <span>Metas</span>
              </div>
              <span className="text-xs font-medium">
                {membro.metas_atingidas}/{membro.total_metas} ({taxaAtingimento}%)
              </span>
            </div>
            <ProgressBar value={taxaAtingimento} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

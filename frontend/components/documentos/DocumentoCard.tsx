"use client";

import Link from "next/link";
import { FileText, ExternalLink, GitBranch, MoreVertical, Pencil, Trash2, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Documento } from "@/types/documentos";
import { TIPO_DOCUMENTO_LABELS, STATUS_DOCUMENTO_LABELS, STATUS_DOCUMENTO_COLORS } from "@/types/documentos";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DocumentoCardProps {
  documento: Documento;
  onEditar: (doc: Documento) => void;
  onDeletar: (id: string) => void;
}

export function DocumentoCard({ documento, onEditar, onDeletar }: DocumentoCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 flex-shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/documentos/${documento.id}`} className="hover:underline">
                <p className="font-semibold text-sm truncate">{documento.titulo}</p>
              </Link>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <Badge variant="outline" className="text-xs">
                  {TIPO_DOCUMENTO_LABELS[documento.tipo]}
                </Badge>
                <Badge
                  variant={
                    (STATUS_DOCUMENTO_COLORS[documento.status] as
                      | "secondary"
                      | "outline"
                      | "default") ?? "secondary"
                  }
                  className="text-xs"
                >
                  {STATUS_DOCUMENTO_LABELS[documento.status]}
                </Badge>
              </div>

              {documento.tags.length > 0 && (
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  {documento.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-muted rounded px-1.5 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                  {documento.tags.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{documento.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  <span>{documento.total_versoes} versão{documento.total_versoes !== 1 ? "ões" : ""}</span>
                </div>
                <span>
                  {formatDistanceToNow(new Date(documento.atualizado_em), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {documento.url_externa && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a href={documento.url_externa} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditar(documento)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDeletar(documento.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

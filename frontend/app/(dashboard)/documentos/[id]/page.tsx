"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, FileText, ExternalLink, GitBranch,
  Plus, Tag, Clock, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDocumento } from "@/hooks/useDocumentos";
import {
  TIPO_DOCUMENTO_LABELS,
  STATUS_DOCUMENTO_LABELS,
  STATUS_DOCUMENTO_COLORS,
} from "@/types/documentos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DocumentoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { documento, isLoading, criarVersao } = useDocumento(id);
  const [showVersaoForm, setShowVersaoForm] = useState(false);
  const [notasVersao, setNotasVersao] = useState("");
  const [loadingVersao, setLoadingVersao] = useState(false);

  const handleCriarVersao = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingVersao(true);
    try {
      await criarVersao(notasVersao);
      setNotasVersao("");
      setShowVersaoForm(false);
    } finally {
      setLoadingVersao(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!documento) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-muted-foreground">Documento não encontrado.</p>
        <Button variant="outline" onClick={() => router.push("/documentos")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Breadcrumb */}
      <Button variant="ghost" size="sm" onClick={() => router.push("/documentos")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar para Documentos
      </Button>

      {/* Cabeçalho do Documento */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="p-3 rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 flex-shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{documento.titulo}</h1>
                {documento.url_externa && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={documento.url_externa} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Link
                    </a>
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline">
                  {TIPO_DOCUMENTO_LABELS[documento.tipo]}
                </Badge>
                <Badge
                  variant={
                    (STATUS_DOCUMENTO_COLORS[documento.status] as
                      | "secondary"
                      | "outline"
                      | "default") ?? "secondary"
                  }
                >
                  {STATUS_DOCUMENTO_LABELS[documento.status]}
                </Badge>
              </div>

              {documento.descricao && (
                <p className="text-sm text-muted-foreground mt-3">{documento.descricao}</p>
              )}

              {documento.tags.length > 0 && (
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  {documento.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-muted rounded px-2 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
                {documento.criado_por_nome && (
                  <div className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    <span>Criado por {documento.criado_por_nome}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    Atualizado em{" "}
                    {format(new Date(documento.atualizado_em), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Versões */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-5 w-5" />
            Histórico de Versões
            <Badge variant="secondary" className="ml-1">
              {documento.total_versoes}
            </Badge>
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setShowVersaoForm(!showVersaoForm)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Versão
          </Button>
        </CardHeader>
        <CardContent>
          {showVersaoForm && (
            <form onSubmit={handleCriarVersao} className="mb-4 p-4 border rounded-lg space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="notas">Notas da Versão</Label>
                <Textarea
                  id="notas"
                  value={notasVersao}
                  onChange={(e) => setNotasVersao(e.target.value)}
                  rows={3}
                  placeholder="Descreva as alterações desta versão..."
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={loadingVersao}>
                  {loadingVersao ? "Criando..." : "Criar Versão"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVersaoForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          {!documento.versoes || documento.versoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <GitBranch className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhuma versão registrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documento.versoes.map((versao) => (
                <div
                  key={versao.id}
                  className="flex items-start gap-3 p-3 rounded-lg border"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 text-xs font-bold flex-shrink-0">
                    v{versao.numero_versao}
                  </div>
                  <div className="flex-1 min-w-0">
                    {versao.notas && (
                      <p className="text-sm">{versao.notas}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      {versao.criado_por_nome && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {versao.criado_por_nome}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(versao.criado_em), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </div>
                  {versao.arquivo && (
                    <Button variant="ghost" size="sm" asChild className="flex-shrink-0">
                      <a href={versao.arquivo} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, UserCog, Mail, Briefcase, Building2,
  Calendar, Target, Plus, Pencil, Trash2, Trophy, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMembro, useMetasMembro } from "@/hooks/useEquipe";
import { MetaForm } from "@/components/equipe/MetaForm";
import type { MetaMembro, MetaFormData } from "@/types/equipe";
import { TIPO_META_LABELS, PERIODO_META_LABELS } from "@/types/equipe";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function ProgressBar({ value, atingida }: { value: number; atingida: boolean }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all ${atingida ? "bg-green-500" : "bg-violet-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function MetaCard({
  meta,
  onEditar,
  onDeletar,
}: {
  meta: MetaMembro;
  onEditar: (m: MetaMembro) => void;
  onDeletar: (id: string) => void;
}) {
  return (
    <Card className={meta.atingida ? "border-green-200 dark:border-green-800" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className="text-xs">
                {TIPO_META_LABELS[meta.tipo]}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {PERIODO_META_LABELS[meta.periodo]}
              </Badge>
              {meta.atingida && (
                <Badge variant="default" className="text-xs bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Atingida
                </Badge>
              )}
            </div>
            <p className="font-medium text-sm">{meta.titulo}</p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditar(meta)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDeletar(meta.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span className="font-medium">
              {Number(meta.valor_atual).toLocaleString("pt-BR")} /
              {Number(meta.valor_meta).toLocaleString("pt-BR")} ({meta.progresso_percentual.toFixed(0)}%)
            </span>
          </div>
          <ProgressBar value={meta.progresso_percentual} atingida={meta.atingida} />
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
          <Calendar className="h-3 w-3" />
          <span>
            {format(new Date(meta.data_inicio), "dd/MM/yy", { locale: ptBR })} →{" "}
            {format(new Date(meta.data_fim), "dd/MM/yy", { locale: ptBR })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MembroDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { membro, isLoading: loadingMembro } = useMembro(id);
  const { metas, isLoading: loadingMetas, criarMeta, atualizarMeta, deletarMeta } =
    useMetasMembro(id);

  const [showMetaForm, setShowMetaForm] = useState(false);
  const [metaEditando, setMetaEditando] = useState<MetaMembro | null>(null);

  const handleSalvarMeta = async (dados: MetaFormData) => {
    if (metaEditando) {
      await atualizarMeta(metaEditando.id, dados);
    } else {
      await criarMeta(dados);
    }
  };

  const handleDeletarMeta = async (metaId: string) => {
    if (confirm("Excluir esta meta?")) {
      await deletarMeta(metaId);
    }
  };

  if (loadingMembro) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!membro) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-muted-foreground">Membro não encontrado.</p>
        <Button variant="outline" onClick={() => router.push("/equipe")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

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
    <div className="space-y-6 p-4 sm:p-6">
      {/* Breadcrumb */}
      <Button variant="ghost" size="sm" onClick={() => router.push("/equipe")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar para Equipe
      </Button>

      {/* Perfil */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-600/20 text-violet-400 text-xl font-bold border border-violet-600/30 flex-shrink-0">
              {iniciais}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{membro.nome}</h1>
                <Badge variant={membro.ativo ? "default" : "secondary"}>
                  {membro.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{membro.email}</span>
                </div>
                {membro.cargo && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    <span>{membro.cargo}</span>
                  </div>
                )}
                {membro.departamento && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>{membro.departamento}</span>
                  </div>
                )}
                {membro.data_admissao && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Desde {format(new Date(membro.data_admissao), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {membro.total_metas > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-3">
                <Trophy className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-lg font-bold">{taxaAtingimento}%</p>
                  <p className="text-xs text-muted-foreground">
                    {membro.metas_atingidas}/{membro.total_metas} metas
                  </p>
                </div>
              </div>
            )}
          </div>
          {membro.observacoes && (
            <p className="mt-4 text-sm text-muted-foreground border-t pt-4">
              {membro.observacoes}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Metas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5" />
            Metas
          </CardTitle>
          <Button
            size="sm"
            onClick={() => { setMetaEditando(null); setShowMetaForm(true); }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Meta
          </Button>
        </CardHeader>
        <CardContent>
          {loadingMetas ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : metas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <Target className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhuma meta cadastrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {metas.map((m) => (
                <MetaCard
                  key={m.id}
                  meta={m}
                  onEditar={(meta) => { setMetaEditando(meta); setShowMetaForm(true); }}
                  onDeletar={handleDeletarMeta}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Meta */}
      {showMetaForm && (
        <MetaForm
          meta={metaEditando}
          onSalvar={handleSalvarMeta}
          onFechar={() => { setShowMetaForm(false); setMetaEditando(null); }}
        />
      )}
    </div>
  );
}

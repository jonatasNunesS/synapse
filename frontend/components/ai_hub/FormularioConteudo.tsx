"use client";

import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TipoConteudo, SolicitacaoConteudo } from "@/types/ai_hub";
import { TIPO_CONTEUDO_LABELS, TIPO_CONTEUDO_ICONE, CAMPOS_OBRIGATORIOS } from "@/types/ai_hub";

interface FormularioConteudoProps {
  onSubmit: (solicitacao: SolicitacaoConteudo) => void;
  gerando: boolean;
  erro: string | null;
}

const TIPOS_DISPONIVEIS: TipoConteudo[] = [
  "legenda_instagram",
  "titulo_produto",
  "descricao_produto",
  "hashtags",
  "ideia_pauta",
  "email_marketing",
  "relatorio_negocio",
  "insight",
  "outro",
];

// Campos longos que rendem melhor em textarea
const CAMPOS_TEXTAREA = ["objetivo", "diferenciais", "descricao"];

export function FormularioConteudo({ onSubmit, gerando, erro }: FormularioConteudoProps) {
  const [tipo, setTipo] = useState<TipoConteudo>("legenda_instagram");
  const [parametros, setParametros] = useState<Record<string, string>>({});

  const campos = CAMPOS_OBRIGATORIOS[tipo] || [];

  const handleTipoChange = (novoTipo: string) => {
    setTipo(novoTipo as TipoConteudo);
    setParametros({});
  };

  const handleCampoChange = (key: string, value: string) => {
    setParametros((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ tipo, parametros });
  };

  const camposObrigatoriosFaltando = campos
    .filter((c) => !parametros[c.key]?.trim())
    .length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Gerar Conteúdo com IA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de conteúdo */}
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo de conteúdo</Label>
            <Select value={tipo} onValueChange={handleTipoChange}>
              <SelectTrigger id="tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DISPONIVEIS.map((t) => (
                  <SelectItem key={t} value={t}>
                    <span className="flex items-center gap-2">
                      <span>{TIPO_CONTEUDO_ICONE[t]}</span>
                      <span>{TIPO_CONTEUDO_LABELS[t]}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campos dinâmicos por tipo */}
          {campos.length === 0 ? (
            <div className="rounded-lg bg-purple-50 border border-purple-100 p-3 text-sm text-purple-700">
              <p className="font-medium mb-1">Geração automática</p>
              <p className="text-xs text-purple-600">
                Este tipo de conteúdo usa os dados do seu negócio automaticamente.
                Clique em &quot;Gerar&quot; para criar.
              </p>
            </div>
          ) : (
            campos.map((campo) => (
              <div key={campo.key} className="space-y-1.5">
                <Label htmlFor={campo.key}>{campo.label}</Label>
                {CAMPOS_TEXTAREA.includes(campo.key) ? (
                  <Textarea
                    id={campo.key}
                    placeholder={campo.placeholder}
                    value={parametros[campo.key] || ""}
                    onChange={(e) => handleCampoChange(campo.key, e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                ) : (
                  <Input
                    id={campo.key}
                    placeholder={campo.placeholder}
                    value={parametros[campo.key] || ""}
                    onChange={(e) => handleCampoChange(campo.key, e.target.value)}
                  />
                )}
              </div>
            ))
          )}

          {/* Erro */}
          {erro && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {erro}
            </div>
          )}

          {/* Botão */}
          <Button
            type="submit"
            disabled={gerando || (campos.length > 0 && camposObrigatoriosFaltando)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {gerando ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Gerando com IA...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Gerar {TIPO_CONTEUDO_LABELS[tipo]}
              </span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

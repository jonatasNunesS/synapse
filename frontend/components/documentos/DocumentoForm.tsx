"use client";

import { useState } from "react";
import { X, Tag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Documento, DocumentoFormData, TipoDocumento, StatusDocumento } from "@/types/documentos";
import { TIPO_DOCUMENTO_LABELS, STATUS_DOCUMENTO_LABELS } from "@/types/documentos";
import type { ApiError } from "@/types/api";

interface DocumentoFormProps {
  documento?: Documento | null;
  onSalvar: (dados: DocumentoFormData) => Promise<void>;
  onFechar: () => void;
}

export function DocumentoForm({ documento, onSalvar, onFechar }: DocumentoFormProps) {
  const [form, setForm] = useState<DocumentoFormData>({
    titulo: documento?.titulo ?? "",
    descricao: documento?.descricao ?? "",
    tipo: documento?.tipo ?? "outro",
    status: documento?.status ?? "rascunho",
    url_externa: documento?.url_externa ?? "",
    tags: documento?.tags ?? [],
  });
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const adicionarTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags?.includes(tag)) {
      setForm({ ...form, tags: [...(form.tags ?? []), tag] });
    }
    setTagInput("");
  };

  const removerTag = (tag: string) => {
    setForm({ ...form, tags: form.tags?.filter((t) => t !== tag) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro("");
    try {
      await onSalvar(form);
      onFechar();
    } catch (err: unknown) {
      const msg =
        (err as ApiError)
          ?.error?.message ?? "Erro ao salvar documento.";
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">
            {documento ? "Editar Documento" : "Novo Documento"}
          </h2>
          <Button variant="ghost" size="icon" onClick={onFechar}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex: Contrato de Prestação de Serviços"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              rows={3}
              placeholder="Descrição do documento..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm({ ...form, tipo: v as TipoDocumento })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_DOCUMENTO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status *</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as StatusDocumento })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_DOCUMENTO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="url_externa">URL Externa</Label>
            <Input
              id="url_externa"
              type="url"
              value={form.url_externa}
              onChange={(e) => setForm({ ...form, url_externa: e.target.value })}
              placeholder="https://drive.google.com/..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Adicionar tag..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    adicionarTag();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={adicionarTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {(form.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-1"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => removerTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : documento ? "Salvar" : "Criar Documento"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

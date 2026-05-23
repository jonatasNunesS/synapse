"use client";

import { useState } from "react";
import { X } from "lucide-react";
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
import type { MetaMembro, MetaFormData, TipoMeta, PeriodoMeta } from "@/types/equipe";
import { TIPO_META_LABELS, PERIODO_META_LABELS } from "@/types/equipe";

interface MetaFormProps {
  meta?: MetaMembro | null;
  onSalvar: (dados: MetaFormData) => Promise<void>;
  onFechar: () => void;
}

export function MetaForm({ meta, onSalvar, onFechar }: MetaFormProps) {
  const [form, setForm] = useState<MetaFormData>({
    titulo: meta?.titulo ?? "",
    tipo: meta?.tipo ?? "outro",
    valor_meta: meta?.valor_meta ?? "",
    valor_atual: meta?.valor_atual ?? "0",
    periodo: meta?.periodo ?? "mensal",
    data_inicio: meta?.data_inicio ?? "",
    data_fim: meta?.data_fim ?? "",
    observacoes: meta?.observacoes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro("");
    try {
      await onSalvar(form);
      onFechar();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Erro ao salvar meta.";
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
            {meta ? "Editar Meta" : "Nova Meta"}
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
              placeholder="Ex: Fechar 10 contratos no mês"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm({ ...form, tipo: v as TipoMeta })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_META_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Período *</Label>
              <Select
                value={form.periodo}
                onValueChange={(v) => setForm({ ...form, periodo: v as PeriodoMeta })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIODO_META_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="valor_meta">Valor da Meta *</Label>
              <Input
                id="valor_meta"
                type="number"
                step="0.01"
                value={form.valor_meta}
                onChange={(e) => setForm({ ...form, valor_meta: e.target.value })}
                placeholder="100"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor_atual">Valor Atual</Label>
              <Input
                id="valor_atual"
                type="number"
                step="0.01"
                value={form.valor_atual}
                onChange={(e) => setForm({ ...form, valor_atual: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="data_inicio">Data Início *</Label>
              <Input
                id="data_inicio"
                type="date"
                value={form.data_inicio}
                onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data_fim">Data Fim *</Label>
              <Input
                id="data_fim"
                type="date"
                value={form.data_fim}
                onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              rows={2}
              placeholder="Observações sobre a meta..."
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : meta ? "Salvar" : "Criar Meta"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MembroEquipe, MembroFormData } from "@/types/equipe";
import type { ApiError } from "@/types/api";

interface MembroFormProps {
  membro?: MembroEquipe | null;
  usuariosDisponiveis?: { id: string; nome: string; email: string }[];
  onSalvar: (dados: MembroFormData) => Promise<void>;
  onFechar: () => void;
}

export function MembroForm({ membro, usuariosDisponiveis = [], onSalvar, onFechar }: MembroFormProps) {
  const [form, setForm] = useState<MembroFormData>({
    usuario_id: membro?.usuario_id ?? "",
    cargo: membro?.cargo ?? "",
    departamento: membro?.departamento ?? "",
    data_admissao: membro?.data_admissao ?? "",
    salario: membro?.salario ?? "",
    observacoes: membro?.observacoes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membro && !form.usuario_id) {
      setErro("Selecione um usuário.");
      return;
    }
    setLoading(true);
    setErro("");
    try {
      await onSalvar(form);
      onFechar();
    } catch (err: unknown) {
      const msg =
        (err as ApiError)
          ?.error?.message ?? "Erro ao salvar membro.";
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
            {membro ? "Editar Membro" : "Adicionar Membro"}
          </h2>
          <Button variant="ghost" size="icon" onClick={onFechar}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!membro && (
            <div className="space-y-1.5">
              <Label htmlFor="usuario_id">Usuário *</Label>
              <select
                id="usuario_id"
                value={form.usuario_id}
                onChange={(e) => setForm({ ...form, usuario_id: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Selecione um usuário</option>
                {usuariosDisponiveis.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome} — {u.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cargo">Cargo</Label>
            <Input
              id="cargo"
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              placeholder="Ex: Desenvolvedor, Gerente..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="departamento">Departamento</Label>
            <Input
              id="departamento"
              value={form.departamento}
              onChange={(e) => setForm({ ...form, departamento: e.target.value })}
              placeholder="Ex: Tecnologia, Vendas..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="data_admissao">Data de Admissão</Label>
              <Input
                id="data_admissao"
                type="date"
                value={form.data_admissao}
                onChange={(e) => setForm({ ...form, data_admissao: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salario">Salário (R$)</Label>
              <Input
                id="salario"
                type="number"
                step="0.01"
                value={form.salario}
                onChange={(e) => setForm({ ...form, salario: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              rows={3}
              placeholder="Observações sobre o membro..."
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : membro ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

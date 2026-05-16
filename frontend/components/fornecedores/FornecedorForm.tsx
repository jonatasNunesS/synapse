"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2 } from "lucide-react";
import { useFornecedores, useFornecedorDetail, useCategoriasFornecedor } from "@/hooks/useFornecedores";
import type { FornecedorDetail } from "@/types/fornecedores";

const schema = z.object({
  nome: z.string({ message: "Nome é obrigatório" }).min(2, "Mínimo 2 caracteres"),
  nome_contato: z.string().optional(),
  email: z.union([z.string().email("E-mail inválido"), z.literal("")]).optional(),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  site: z.string().optional(),
  cnpj: z.string().optional(),
  endereco_cidade: z.string().optional(),
  endereco_estado: z.string().optional(),
  categoria: z.string().optional(),
  status: z.enum(["ativo", "inativo", "suspenso", "em_avaliacao"], {
    message: "Status inválido",
  }),
  condicoes_pagamento: z.string().optional(),
  prazo_entrega_dias: z.number({ message: "Informe um número" }).int().min(0).optional().or(z.literal(undefined)),
  notas: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface FornecedorFormProps {
  fornecedor?: FornecedorDetail | null;
  onSuccess: (f: FornecedorDetail) => void;
  onClose: () => void;
}

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export function FornecedorForm({ fornecedor, onSuccess, onClose }: FornecedorFormProps) {
  const { criar } = useFornecedores();
  const { atualizar } = useFornecedorDetail();
  const { data: categorias, fetch: fetchCategorias } = useCategoriasFornecedor();
  const [serverError, setServerError] = useState<string | null>(null);

  const isEdit = !!fornecedor;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: fornecedor
      ? {
          nome: fornecedor.nome,
          nome_contato: fornecedor.nome_contato ?? "",
          email: fornecedor.email ?? "",
          telefone: fornecedor.telefone ?? "",
          whatsapp: fornecedor.whatsapp ?? "",
          site: fornecedor.site ?? "",
          cnpj: fornecedor.cnpj ?? "",
          endereco_cidade: fornecedor.endereco_cidade ?? "",
          endereco_estado: fornecedor.endereco_estado ?? "",
          categoria: fornecedor.categoria ?? "",
          status: fornecedor.status,
          condicoes_pagamento: fornecedor.condicoes_pagamento ?? "",
          prazo_entrega_dias: fornecedor.prazo_entrega_dias ?? undefined,
          notas: fornecedor.notas ?? "",
        }
      : {
          status: "ativo",
        },
  });

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      // Limpar campos vazios opcionais
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== "" && v !== undefined)
      ) as FormValues;

      let result: FornecedorDetail;
      if (isEdit && fornecedor) {
        result = await atualizar(fornecedor.id, payload);
      } else {
        result = await criar(payload);
      }
      onSuccess(result);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string; details?: Record<string, string[]> } } } };
      const details = e?.response?.data?.error?.details;
      if (details) {
        const msgs = Object.entries(details)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join(" | ");
        setServerError(msgs);
      } else {
        setServerError(e?.response?.data?.error?.message ?? "Erro ao salvar fornecedor");
      }
    }
  };

  const field = (
    name: keyof FormValues,
    label: string,
    type = "text",
    placeholder = ""
  ) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-400">{label}</label>
      <input
        {...register(name, type === "number" ? { valueAsNumber: true } : {})}
        type={type}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
      />
      {errors[name] && (
        <p className="mt-1 text-xs text-red-400">{errors[name]?.message as string}</p>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-base font-semibold text-white">
            {isEdit ? "Editar Fornecedor" : "Novo Fornecedor"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[80vh] overflow-y-auto p-6">
          {serverError && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Nome */}
            <div className="sm:col-span-2">
              {field("nome", "Nome *", "text", "Razão social ou nome fantasia")}
            </div>

            {/* Contato */}
            {field("nome_contato", "Nome do Contato", "text", "Responsável")}
            {field("email", "E-mail", "email", "contato@empresa.com")}
            {field("telefone", "Telefone", "text", "(11) 99999-9999")}
            {field("whatsapp", "WhatsApp", "text", "(11) 99999-9999")}

            {/* Empresa */}
            {field("cnpj", "CNPJ", "text", "00.000.000/0001-00")}
            {field("site", "Site", "text", "https://empresa.com")}

            {/* Localização */}
            {field("endereco_cidade", "Cidade", "text", "São Paulo")}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Estado</label>
              <select
                {...register("endereco_estado")}
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50"
              >
                <option value="">Selecionar</option>
                {ESTADOS.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>

            {/* Categoria */}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Categoria</label>
              <select
                {...register("categoria")}
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50"
              >
                <option value="">Sem categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Status *</label>
              <select
                {...register("status")}
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="suspenso">Suspenso</option>
                <option value="em_avaliacao">Em Avaliação</option>
              </select>
              {errors.status && (
                <p className="mt-1 text-xs text-red-400">{errors.status.message}</p>
              )}
            </div>

            {/* Condições comerciais */}
            {field("condicoes_pagamento", "Condições de Pagamento", "text", "30/60/90 dias")}
            {field("prazo_entrega_dias", "Prazo de Entrega (dias)", "number", "7")}

            {/* Notas */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-zinc-400">Notas</label>
              <textarea
                {...register("notas")}
                rows={3}
                placeholder="Observações sobre o fornecedor..."
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar Alterações" : "Criar Fornecedor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

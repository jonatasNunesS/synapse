"use client";
/**
 * Synapse — M7: Modal de Convite de Membro
 * Bug E: componente faltante — criado para uso na página /equipe
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { X, Loader2, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import type { ApiError } from "@/types/api";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(255),
  perfil: z.enum(["admin", "gerente", "colaborador"]),
  cargo: z.string().max(100).optional(),
  departamento: z.string().max(100).optional(),
});

type FormData = z.infer<typeof schema>;

interface ConvidarModalProps {
  onFechar: () => void;
  onConvidado?: () => void;
}

export function ConvidarModal({ onFechar, onConvidado }: ConvidarModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { perfil: "colaborador" },
  });

  const onSubmit = async (dados: FormData) => {
    try {
      const resp = await api.post<{ email_convite_enviado?: boolean }>(
        "/equipe/convidar/",
        dados
      );
      const mensagem = resp.message || `Convite enviado para ${dados.email}.`;
      if (resp.data?.email_convite_enviado === false) {
        // Membro criado, mas o servidor não tem RESEND_API_KEY configurada
        toast.warning(mensagem, { duration: 8000 });
      } else {
        toast.success(mensagem);
      }
      onConvidado?.();
      onFechar();
    } catch (err: unknown) {
      // api (lib/api.ts) é wrapper de fetch: lança o corpo ApiError direto,
      // não existe err.response.data como no axios
      const e = err as ApiError;
      const details = e?.error?.details as Record<string, string[]> | undefined;
      const mensagem = e?.error?.message ?? "Erro ao enviar convite.";
      if (details?.email?.[0]) {
        setError("email", { message: details.email[0] });
        toast.error(details.email[0]);
      } else {
        setError("root", { message: mensagem });
        toast.error(mensagem);
      }
      // Modal permanece aberto para o usuário corrigir e reenviar
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFechar}
      />
      <div className="relative bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Convidar Membro</h2>
          </div>
          <button
            onClick={onFechar}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {errors.root && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {errors.root.message}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              E-mail <span className="text-red-400">*</span>
            </label>
            <input
              {...register("email")}
              type="email"
              placeholder="colaborador@empresa.com"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors text-sm"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Nome Completo <span className="text-red-400">*</span>
            </label>
            <input
              {...register("nome")}
              placeholder="João da Silva"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors text-sm"
            />
            {errors.nome && (
              <p className="mt-1 text-xs text-red-400">{errors.nome.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Perfil de Acesso <span className="text-red-400">*</span>
            </label>
            <select
              {...register("perfil")}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500/50 transition-colors text-sm"
            >
              <option value="colaborador" className="bg-[#0d1117]">Colaborador</option>
              <option value="gerente" className="bg-[#0d1117]">Gerente</option>
              <option value="admin" className="bg-[#0d1117]">Administrador</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Cargo <span className="text-slate-500 text-xs">(opcional)</span>
              </label>
              <input
                {...register("cargo")}
                placeholder="Ex: Analista"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Departamento <span className="text-slate-500 text-xs">(opcional)</span>
              </label>
              <input
                {...register("departamento")}
                placeholder="Ex: Vendas"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors text-sm"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Um e-mail de acesso será enviado ao novo membro com as credenciais de entrada.
          </p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onFechar}
              className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar Convite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

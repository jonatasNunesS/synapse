"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Bell,
  CreditCard,
  Save,
  Loader2,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { api } from "@/lib/api";
import { PLANO_LABELS, PLANO_CORES, SEGMENTOS } from "@/types/auth";

// ── Schema de empresa ────────────────────────────────────────────────────────

const empresaSchema = z.object({
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(255),
  segmento: z.string().min(1, "Selecione um segmento"),
  cnpj: z.string().optional(),
});

type EmpresaForm = z.infer<typeof empresaSchema>;

// ── Componente ───────────────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  const { empresa, usuario } = useAppStore();
  const [empresaOk, setEmpresaOk] = useState(false);
  const [empresaErro, setEmpresaErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmpresaForm>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      nome: empresa?.nome ?? "",
      segmento: empresa?.segmento ?? "",
      cnpj: empresa?.cnpj ?? "",
    },
  });

  const onSalvarEmpresa = async (dados: EmpresaForm) => {
    setEmpresaErro(null);
    setEmpresaOk(false);
    try {
      await api.patch("/auth/empresa/", dados);
      setEmpresaOk(true);
      setTimeout(() => setEmpresaOk(false), 3000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setEmpresaErro(e?.response?.data?.error?.message ?? "Erro ao salvar configurações.");
    }
  };

  const isAdmin = usuario?.perfil === "admin";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-slate-400 text-sm mt-1">
          Gerencie as configurações da sua empresa e conta.
        </p>
      </div>

      {/* Plano atual */}
      {empresa && (
        <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
          <div className="p-2.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30">
            <CreditCard className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-400">Plano atual</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-xs px-2 py-0.5 rounded-full text-white font-medium ${PLANO_CORES[empresa.plano]}`}
              >
                {PLANO_LABELS[empresa.plano]}
              </span>
              {empresa.plano_ativo ? (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Ativo
                </span>
              ) : (
                <span className="text-xs text-red-400">Inativo</span>
              )}
            </div>
          </div>
          {empresa.plano_validade && (
            <p className="text-xs text-slate-500">
              Válido até{" "}
              {new Date(empresa.plano_validade).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      )}

      {/* Dados da empresa */}
      <section className="bg-[#0d1117] border border-white/10 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-400" />
          Dados da Empresa
        </h2>

        {!isAdmin && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
            Apenas administradores podem editar os dados da empresa.
          </div>
        )}

        <form onSubmit={handleSubmit(onSalvarEmpresa)} className="space-y-4">
          {empresaErro && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {empresaErro}
            </div>
          )}
          {empresaOk && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Configurações salvas com sucesso!
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Nome da Empresa
            </label>
            <input
              {...register("nome")}
              disabled={!isAdmin}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {errors.nome && <p className="mt-1 text-xs text-red-400">{errors.nome.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Segmento
              </label>
              <select
                {...register("segmento")}
                disabled={!isAdmin}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500/50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" className="bg-[#0d1117]">Selecione...</option>
                {SEGMENTOS.map((s) => (
                  <option key={s.value} value={s.value} className="bg-[#0d1117]">
                    {s.label}
                  </option>
                ))}
              </select>
              {errors.segmento && <p className="mt-1 text-xs text-red-400">{errors.segmento.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                CNPJ <span className="text-slate-500 text-xs">(opcional)</span>
              </label>
              <input
                {...register("cnpj")}
                disabled={!isAdmin}
                placeholder="00.000.000/0001-00"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar Configurações
              </button>
            </div>
          )}
        </form>
      </section>

      {/* Notificações */}
      <section className="bg-[#0d1117] border border-white/10 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-400" />
          Preferências de Notificação
        </h2>
        <div className="space-y-3">
          {[
            { label: "Alertas de estoque mínimo", desc: "Receba alertas quando produtos atingirem o estoque mínimo" },
            { label: "Vencimento de documentos", desc: "Notificações 7 dias antes do vencimento" },
            { label: "Tarefas atrasadas", desc: "Alertas de tarefas com prazo vencido" },
            { label: "Metas da equipe", desc: "Resumo semanal do progresso das metas" },
          ].map((item) => (
            <label
              key={item.label}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/3 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                defaultChecked
                className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-600 focus:ring-indigo-500/50 cursor-pointer"
              />
              <div>
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-4">
          * As preferências de notificação serão salvas automaticamente em breve.
        </p>
      </section>
    </div>
  );
}

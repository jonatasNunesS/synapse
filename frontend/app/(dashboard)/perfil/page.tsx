"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Lock, Save, Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/store/useAppStore";
import { api } from "@/lib/api";
import type { AtualizarPerfilPayload } from "@/types/auth";

// ── Schema de perfil ─────────────────────────────────────────────────────────

const perfilSchema = z.object({
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(150),
  avatar_url: z.string().url("URL inválida").optional().or(z.literal("")),
});

const senhaSchema = z
  .object({
    senha_atual: z.string().min(1, "Informe a senha atual"),
    nova_senha: z.string().min(8, "Mínimo de 8 caracteres"),
    confirmar_senha: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((d) => d.nova_senha === d.confirmar_senha, {
    message: "As senhas não coincidem",
    path: ["confirmar_senha"],
  });

type PerfilForm = z.infer<typeof perfilSchema>;
type SenhaForm = z.infer<typeof senhaSchema>;

// ── Componente ───────────────────────────────────────────────────────────────

export default function PerfilPage() {
  const { atualizarPerfil } = useAuth();
  const { usuario, empresa } = useAppStore();

  const [perfilOk, setPerfilOk] = useState(false);
  const [senhaOk, setSenhaOk] = useState(false);
  const [perfilErro, setPerfilErro] = useState<string | null>(null);
  const [senhaErro, setSenhaErro] = useState<string | null>(null);

  const {
    register: regPerfil,
    handleSubmit: handlePerfil,
    formState: { errors: errPerfil, isSubmitting: loadingPerfil },
  } = useForm<PerfilForm>({
    resolver: zodResolver(perfilSchema),
    defaultValues: {
      nome: usuario?.nome ?? "",
      avatar_url: usuario?.avatar_url ?? "",
    },
  });

  const {
    register: regSenha,
    handleSubmit: handleSenha,
    reset: resetSenha,
    formState: { errors: errSenha, isSubmitting: loadingSenha },
  } = useForm<SenhaForm>({ resolver: zodResolver(senhaSchema) });

  const onSalvarPerfil = async (dados: PerfilForm) => {
    setPerfilErro(null);
    setPerfilOk(false);
    try {
      const payload: AtualizarPerfilPayload = {
        nome: dados.nome,
        avatar_url: dados.avatar_url || undefined,
      };
      await atualizarPerfil(payload);
      setPerfilOk(true);
      setTimeout(() => setPerfilOk(false), 3000);
    } catch {
      setPerfilErro("Erro ao salvar perfil. Tente novamente.");
    }
  };

  const onTrocarSenha = async (dados: SenhaForm) => {
    setSenhaErro(null);
    setSenhaOk(false);
    try {
      await api.post("/auth/trocar-senha/", {
        senha_atual: dados.senha_atual,
        nova_senha: dados.nova_senha,
        confirmar_senha: dados.confirmar_senha,
      });
      setSenhaOk(true);
      resetSenha();
      setTimeout(() => setSenhaOk(false), 3000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setSenhaErro(e?.response?.data?.error?.message ?? "Erro ao trocar senha.");
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-white">Meu Perfil</h1>
        <p className="text-slate-400 text-sm mt-1">
          Gerencie suas informações pessoais e senha de acesso.
        </p>
      </div>

      {/* Avatar + info */}
      <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
        <div className="w-16 h-16 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center overflow-hidden flex-shrink-0">
          {usuario?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={usuario.avatar_url} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <User className="w-8 h-8 text-indigo-400" />
          )}
        </div>
        <div>
          <p className="font-semibold text-white">{usuario?.nome}</p>
          <p className="text-sm text-slate-400">{usuario?.email}</p>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mt-1 inline-block capitalize">
            {usuario?.perfil}
          </span>
        </div>
        {empresa && (
          <div className="ml-auto text-right">
            <p className="text-sm font-medium text-white">{empresa.nome}</p>
            <p className="text-xs text-slate-500 capitalize">{empresa.segmento}</p>
          </div>
        )}
      </div>

      {/* Formulário de perfil */}
      <section className="bg-[#0d1117] border border-white/10 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-400" />
          Informações Pessoais
        </h2>

        <form onSubmit={handlePerfil(onSalvarPerfil)} className="space-y-4">
          {perfilErro && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {perfilErro}
            </div>
          )}
          {perfilOk && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Perfil atualizado com sucesso!
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome</label>
            <input
              {...regPerfil("nome")}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors text-sm"
            />
            {errPerfil.nome && <p className="mt-1 text-xs text-red-400">{errPerfil.nome.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              URL do Avatar <span className="text-slate-500 text-xs">(opcional)</span>
            </label>
            <input
              {...regPerfil("avatar_url")}
              type="url"
              placeholder="https://..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors text-sm"
            />
            {errPerfil.avatar_url && <p className="mt-1 text-xs text-red-400">{errPerfil.avatar_url.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">E-mail</label>
            <input
              value={usuario?.email ?? ""}
              disabled
              className="w-full px-3 py-2.5 bg-white/3 border border-white/5 rounded-lg text-slate-500 text-sm cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-slate-500">O e-mail não pode ser alterado.</p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loadingPerfil}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors"
            >
              {loadingPerfil ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </button>
          </div>
        </form>
      </section>

      {/* Formulário de senha */}
      <section className="bg-[#0d1117] border border-white/10 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
          <Lock className="w-4 h-4 text-indigo-400" />
          Alterar Senha
        </h2>

        <form onSubmit={handleSenha(onTrocarSenha)} className="space-y-4">
          {senhaErro && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {senhaErro}
            </div>
          )}
          {senhaOk && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Senha alterada com sucesso!
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Senha Atual</label>
            <input
              {...regSenha("senha_atual")}
              type="password"
              autoComplete="current-password"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors text-sm"
            />
            {errSenha.senha_atual && <p className="mt-1 text-xs text-red-400">{errSenha.senha_atual.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Nova Senha</label>
              <input
                {...regSenha("nova_senha")}
                type="password"
                autoComplete="new-password"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors text-sm"
              />
              {errSenha.nova_senha && <p className="mt-1 text-xs text-red-400">{errSenha.nova_senha.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar Nova Senha</label>
              <input
                {...regSenha("confirmar_senha")}
                type="password"
                autoComplete="new-password"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors text-sm"
              />
              {errSenha.confirmar_senha && <p className="mt-1 text-xs text-red-400">{errSenha.confirmar_senha.message}</p>}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loadingSenha}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors"
            >
              {loadingSenha ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Alterar Senha
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

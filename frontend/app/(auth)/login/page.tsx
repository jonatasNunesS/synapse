"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/api";

// ── Schema de Validação ──────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("E-mail inválido.").min(1, "E-mail é obrigatório."),
  senha: z.string().min(1, "Senha é obrigatória."),
});

type LoginForm = z.infer<typeof loginSchema>;

// ── Componente interno (usa useSearchParams) ─────────────────

function LoginContent() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const senhaRedefinida = searchParams.get("senha_redefinida") === "1";

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await login({ email: data.email, senha: data.senha });
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="text-2xl font-bold text-white tracking-tight">Synapse</span>
      </div>

      {/* Card */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
        <h1 className="text-xl font-semibold text-white mb-1">Bem-vindo de volta</h1>
        <p className="text-sm text-slate-400 mb-6">
          Acesse sua conta para continuar.
        </p>

        {/* Mensagem de senha redefinida */}
        {senhaRedefinida && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            Senha redefinida com sucesso! Faça login com a nova senha.
          </div>
        )}

        {/* Erro do servidor */}
        {serverError && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* E-mail */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              E-mail
            </label>
            <input
              {...register("email")}
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-900/60 border text-white placeholder-slate-500 text-sm
                focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors
                ${errors.email ? "border-red-500/60" : "border-slate-700/60 focus:border-violet-500/60"}`}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>

          {/* Senha */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-300">
                Senha
              </label>
              <Link
                href="/recuperar-senha"
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Esqueci minha senha
              </Link>
            </div>
            <div className="relative">
              <input
                {...register("senha")}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className={`w-full px-3.5 py-2.5 pr-10 rounded-lg bg-slate-900/60 border text-white placeholder-slate-500 text-sm
                  focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors
                  ${errors.senha ? "border-red-500/60" : "border-slate-700/60 focus:border-violet-500/60"}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.senha && (
              <p className="mt-1 text-xs text-red-400">{errors.senha.message}</p>
            )}
          </div>

          {/* Botão */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50
              text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        {/* Link para registro */}
        <p className="mt-5 text-center text-sm text-slate-500">
          Não tem uma conta?{" "}
          <Link
            href="/registro"
            className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
          >
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  );
}

// ── Página exportada com Suspense ────────────────────────────

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

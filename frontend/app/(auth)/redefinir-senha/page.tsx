"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, ArrowLeft, Eye, EyeOff, Loader2, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/api";

const schema = z
  .object({
    nova_senha: z
      .string()
      .min(8, "Senha deve ter pelo menos 8 caracteres.")
      .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula.")
      .regex(/[0-9]/, "Senha deve conter pelo menos um número."),
    confirmar_senha: z.string().min(1, "Confirme sua nova senha."),
  })
  .refine((data) => data.nova_senha === data.confirmar_senha, {
    message: "As senhas não coincidem.",
    path: ["confirmar_senha"],
  });

type FormData = z.infer<typeof schema>;

// ── Componente interno (usa useSearchParams) ─────────────────

function RedefinirSenhaContent() {
  const { redefinirSenha } = useAuth();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  // Mesmo fluxo/endpoint do reset, com textos de onboarding quando é convite
  const isConvite = searchParams.get("convite") === "1";

  const [showNova, setShowNova] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    if (!token) return;
    setServerError(null);
    setIsSubmitting(true);
    try {
      await redefinirSenha(
        {
          token,
          nova_senha: data.nova_senha,
          confirmar_senha: data.confirmar_senha,
        },
        isConvite,
      );
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full px-3.5 py-2.5 pr-10 rounded-lg bg-card/60 border text-white placeholder-slate-500 text-sm
    focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-colors
    ${hasError ? "border-red-500/60" : "border-border/60 focus:border-brand-500/60"}`;

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="text-2xl font-bold text-foreground tracking-tight">Synapse</span>
      </div>

      <div className="bg-secondary/60 border border-border/50 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
        {/* Token inválido */}
        {!token ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-alerta" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">Link inválido</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {isConvite
                ? "O link de convite é inválido ou expirou. Peça ao administrador para reenviar o convite."
                : "O link de redefinição de senha é inválido ou expirou."}
            </p>
            <Link
              href={isConvite ? "/login" : "/recuperar-senha"}
              className="inline-flex items-center gap-2 text-sm text-brand-accent hover:text-brand-accent transition-colors"
            >
              {isConvite ? "Ir para o login" : "Solicitar novo link"}
            </Link>
          </div>
        ) : (
          <>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-suave hover:text-foreground-suave transition-colors mb-5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </Link>

            <h1 className="text-xl font-semibold text-foreground mb-1">
              {isConvite ? "Bem-vindo(a) ao Synapse!" : "Nova senha"}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {isConvite
                ? "Defina sua senha para acessar sua conta."
                : "Escolha uma senha forte para sua conta."}
            </p>

            {serverError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-erro text-sm">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-suave mb-1.5">
                  Nova senha
                </label>
                <div className="relative">
                  <input
                    {...register("nova_senha")}
                    type={showNova ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Mín. 8 caracteres"
                    className={inputClass(!!errors.nova_senha)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNova(!showNova)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-suave hover:text-foreground-suave"
                  >
                    {showNova ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.nova_senha && (
                  <p className="mt-1 text-xs text-erro">{errors.nova_senha.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground-suave mb-1.5">
                  Confirmar nova senha
                </label>
                <div className="relative">
                  <input
                    {...register("confirmar_senha")}
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Repita a nova senha"
                    className={inputClass(!!errors.confirmar_senha)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-suave hover:text-foreground-suave"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmar_senha && (
                  <p className="mt-1 text-xs text-erro">{errors.confirmar_senha.message}</p>
                )}
              </div>

              {/* Dicas de senha */}
              <div className="p-3 rounded-lg bg-card/40 border border-border/30">
                <p className="text-xs text-muted-suave mb-1.5 font-medium">Requisitos:</p>
                <ul className="space-y-0.5 text-xs text-muted-suave">
                  <li>• Mínimo de 8 caracteres</li>
                  <li>• Pelo menos uma letra maiúscula</li>
                  <li>• Pelo menos um número</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:bg-brand-600/50
                  text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isConvite ? "Salvando..." : "Redefinindo..."}
                  </>
                ) : isConvite ? (
                  "Definir senha e acessar"
                ) : (
                  "Redefinir senha"
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Página exportada com Suspense ────────────────────────────

export default function RedefinirSenhaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        </div>
      }
    >
      <RedefinirSenhaContent />
    </Suspense>
  );
}

"use client";
/**
 * Layout do Painel Administrativo (área de PLATAFORMA, não é dashboard de
 * cliente). Guard de rota: só entra quem é is_staff_synapse; qualquer outro é
 * redirecionado para o dashboard. Cabeçalho visualmente distinto (faixa âmbar)
 * pra deixar claro que é a plataforma Synapse.
 */
import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function PainelAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { usuario, autenticado, loading, carregarUsuario } = useAuth();

  useEffect(() => {
    if (!autenticado) carregarUsuario();
  }, [autenticado, carregarUsuario]);

  // Guard: usuário carregado e NÃO é staff → fora daqui.
  useEffect(() => {
    if (autenticado && usuario && !usuario.is_staff_synapse) {
      router.replace("/");
    }
  }, [autenticado, usuario, router]);

  // Carregando o usuário, ou ainda validando o acesso.
  if (loading || !autenticado || !usuario) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-slate-500">Verificando acesso…</p>
        </div>
      </div>
    );
  }

  if (!usuario.is_staff_synapse) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-slate-400">Redirecionando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Faixa de plataforma — deliberadamente distinta do dashboard do cliente */}
      <header className="sticky top-0 z-10 border-b border-amber-500/30 bg-gradient-to-r from-amber-950/60 to-slate-950">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-300 leading-tight">
                Plataforma Synapse
              </p>
              <p className="text-[11px] text-amber-500/70 leading-tight">
                Painel Administrativo — visão interna
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-400">
              {usuario.nome} · staff
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Sair do painel
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">{children}</main>
      <Toaster theme="dark" richColors position="top-right" />
    </div>
  );
}

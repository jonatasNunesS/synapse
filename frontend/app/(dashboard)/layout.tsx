"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/hooks/useAuth";
import { useModulos, MODULO_LABEL } from "@/hooks/useModulos";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { EmpresaSuspensaAviso } from "@/components/layout/EmpresaSuspensaAviso";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarOpen } = useAppStore();
  const { carregarUsuario, loading, autenticado, empresa } = useAuth();
  const { rotaPermitida, moduloDaRota } = useModulos();
  const pathname = usePathname();
  const router = useRouter();

  // Carrega dados do usuário ao montar o layout (se ainda não carregado)
  useEffect(() => {
    if (!autenticado) {
      carregarUsuario();
    }
  }, [autenticado, carregarUsuario]);

  // Guard de rota: módulo desligado → volta pro dashboard com aviso.
  // Só age depois do usuário carregado (antes disso tudo é considerado ativo).
  useEffect(() => {
    if (!autenticado || rotaPermitida(pathname)) return;
    const modulo = moduloDaRota(pathname);
    toast.error(
      modulo ? `Módulo ${MODULO_LABEL[modulo]} desativado` : "Módulo desativado",
      { description: "Ative em Configurações para voltar a usar." }
    );
    router.replace("/dashboard");
  }, [autenticado, pathname, rotaPermitida, moduloDaRota, router]);

  // Tela de loading enquanto busca o usuário
  if (loading && !autenticado) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <p className="text-sm text-slate-500">Carregando...</p>
        </div>
      </div>
    );
  }

  // Empresa suspensa: o usuário logou, mas só vê o aviso (não acessa o sistema).
  if (autenticado && empresa?.status === "suspensa") {
    return <EmpresaSuspensaAviso />;
  }

  return (
    <div className="tema-app min-h-screen bg-slate-950">
      <Sidebar />
      <Header />
      <main
        className={cn(
          "pt-[64px] min-h-screen transition-all duration-300",
          // Mobile (< md): sem padding lateral — sidebar fica como overlay
          // Desktop (>= md): padding conforme estado da sidebar
          sidebarOpen ? "md:pl-[256px]" : "md:pl-[64px]"
        )}
      >
        <div className="p-4 md:p-6">{children}</div>
      </main>
      <Toaster theme="dark" richColors position="top-right" />
    </div>
  );
}

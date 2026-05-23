"use client";

import React, { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarOpen } = useAppStore();
  const { carregarUsuario, loading, autenticado } = useAuth();

  // Carrega dados do usuário ao montar o layout (se ainda não carregado)
  useEffect(() => {
    if (!autenticado) {
      carregarUsuario();
    }
  }, [autenticado, carregarUsuario]);

  // Tela de loading enquanto busca o usuário
  if (loading && !autenticado) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-sm text-slate-500">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <Header />
      <main
        className={cn(
          "pt-16 min-h-screen transition-all duration-300",
          // Mobile (< md): sem padding lateral — sidebar fica como overlay
          // Desktop (>= md): padding conforme estado da sidebar
          sidebarOpen ? "md:pl-64" : "md:pl-16"
        )}
      >
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}

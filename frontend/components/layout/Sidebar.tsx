"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  DollarSign,
  Package,
  Users,
  Truck,
  FolderKanban,
  UserCog,
  FileText,
  Bell,
  Sparkles,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/hooks/useAuth";
import { PLANO_CORES, PLANO_LABELS } from "@/types/auth";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  disabled?: boolean;
}

const navigation: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Financeiro", href: "/financeiro", icon: DollarSign },
  { label: "Estoque", href: "/estoque", icon: Package },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Fornecedores", href: "/fornecedores", icon: Truck },
  { label: "Projetos", href: "/projetos", icon: FolderKanban },
  { label: "Equipe", href: "/equipe", icon: UserCog },
  { label: "Documentos", href: "/documentos", icon: FileText },
  { label: "Notificações", href: "/notificacoes", icon: Bell },
  { label: "Analytics", href: "/analytics", icon: BarChart2 },
  { label: "AI Hub", href: "/ai-hub", icon: Sparkles },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useAppStore();
  const { usuario, empresa, logout } = useAuth();

  // Iniciais do nome do usuário para o avatar
  const iniciais = usuario?.nome
    ? usuario.nome
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  const plano = empresa?.plano ?? "starter";
  const planoLabel = PLANO_LABELS[plano];
  const planoCor = PLANO_CORES[plano];

  const handleNavClick = () => {
    // Em mobile (< md), fecha a sidebar ao navegar
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      {/* ── Overlay mobile ──────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-800 bg-slate-900 transition-all duration-300",
          // Desktop: colapsa para w-16 quando fechado
          // Mobile: some completamente (translate) quando fechado
          sidebarOpen
            ? "w-64 translate-x-0"
            : "w-16 -translate-x-full md:translate-x-0"
        )}
      >
        {/* ── Logo ──────────────────────────────────────────── */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          {sidebarOpen && (
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">Synapse</span>
            </Link>
          )}
          {!sidebarOpen && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 mx-auto">
              <Zap className="h-4 w-4 text-white" />
            </div>
          )}
          {sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
              aria-label="Recolher menu"
            >
              {/* Em mobile mostra X, em desktop mostra ChevronLeft */}
              <span className="md:hidden">
                <X className="h-4 w-4" />
              </span>
              <span className="hidden md:block">
                <ChevronLeft className="h-4 w-4" />
              </span>
            </button>
          )}
        </div>

        {/* ── Botão expandir (quando recolhido, apenas desktop) ─ */}
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="absolute -right-3 top-[72px] hidden md:flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300 transition-colors shadow-md"
            aria-label="Expandir menu"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        )}

        {/* ── Navegação ─────────────────────────────────────── */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
  key={item.href}
  href={item.disabled ? "#" : item.href}
  className={cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
    isActive
      ? "bg-violet-600/15 text-violet-400 shadow-sm"
      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
    item.disabled && "cursor-not-allowed opacity-40",
    !sidebarOpen && "justify-center px-2"
  )}
  onClick={(e) => {
    if (item.disabled) {
      e.preventDefault();
      return;
    }
    handleNavClick();
  }}
  title={!sidebarOpen ? item.label : undefined}
>
  <Icon
    className={cn(
      "h-4 w-4 shrink-0",
      isActive ? "text-violet-400" : "text-slate-500"
    )}
  />
  {sidebarOpen && (
    <>
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-violet-600 px-1.5 text-[10px] font-bold text-white">
          {item.badge}
        </span>
      )}
      {item.disabled && (
        <span className="text-[10px] text-slate-600 font-normal">breve</span>
      )}
    </>
  )}
</Link>

            );
          })}
        </nav>

        {/* ── Footer: Usuário ────────────────────────────────── */}
        <div className="border-t border-slate-800 p-3">
          {sidebarOpen ? (
            <div className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-800 transition-colors cursor-default">
              {/* Avatar */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-violet-400 text-xs font-bold border border-violet-600/30">
                {iniciais}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {usuario?.nome ?? "Carregando..."}
                </p>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex h-1.5 w-1.5 rounded-full",
                      planoCor
                    )}
                  />
                  <p className="text-xs text-slate-500 truncate">{planoLabel}</p>
                </div>
              </div>
              {/* Logout */}
              <button
                onClick={() => logout()}
                className="opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Sair"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => logout()}
                title="Sair"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600/20 text-violet-400 text-xs font-bold border border-violet-600/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all"
              >
                {iniciais}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

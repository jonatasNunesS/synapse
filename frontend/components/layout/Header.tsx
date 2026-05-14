"use client";

import React from "react";
import Link from "next/link";
import { Bell, Search, LogOut, User, Settings, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/hooks/useAuth";
import { PLANO_LABELS } from "@/types/auth";

export function Header() {
  const { sidebarOpen, unreadNotifications } = useAppStore();
  const { usuario, empresa, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  const iniciais = usuario?.nome
    ? usuario.nome
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  const planoLabel = empresa?.plano ? PLANO_LABELS[empresa.plano] : "Starter";

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm px-6 transition-all duration-300",
        sidebarOpen ? "left-64" : "left-16"
      )}
    >
      {/* ── Busca ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            placeholder="Buscar..."
            className="h-9 w-full rounded-lg border border-slate-800 bg-slate-900/60 pl-9 pr-4 text-sm text-slate-300 placeholder:text-slate-600
              focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/40 transition-colors"
          />
        </div>
      </div>

      {/* ── Ações ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        {/* Notificações */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          )}
        </button>

        {/* Menu do Usuário */}
        <div className="relative ml-1">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-slate-800 transition-colors"
          >
            {/* Avatar */}
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600/20 text-violet-400 text-xs font-bold border border-violet-600/30">
              {iniciais}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-slate-200 leading-none">
                {usuario?.nome?.split(" ")[0] ?? "Usuário"}
              </p>
              <p className="text-xs text-slate-500 leading-none mt-0.5">{planoLabel}</p>
            </div>
          </button>

          {/* Dropdown */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-slate-800 bg-slate-900 p-1.5 shadow-2xl shadow-black/40">
                {/* Info do usuário */}
                <div className="px-3 py-2.5 border-b border-slate-800 mb-1.5">
                  <p className="text-sm font-semibold text-slate-200">
                    {usuario?.nome ?? "Usuário"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{usuario?.email}</p>
                </div>

                {/* Info da empresa */}
                {empresa && (
                  <div className="px-3 py-2 border-b border-slate-800 mb-1.5">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-slate-600" />
                      <div>
                        <p className="text-xs font-medium text-slate-300 truncate max-w-[160px]">
                          {empresa.nome}
                        </p>
                        <p className="text-[11px] text-slate-600">Plano {planoLabel}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ações */}
                <Link
                  href="/perfil"
                  onClick={() => setShowUserMenu(false)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                >
                  <User className="h-4 w-4" />
                  Meu Perfil
                </Link>
                <Link
                  href="/configuracoes"
                  onClick={() => setShowUserMenu(false)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  Configurações
                </Link>

                <div className="border-t border-slate-800 mt-1.5 pt-1.5">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair da conta
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

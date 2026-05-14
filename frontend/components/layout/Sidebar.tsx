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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  disabled?: boolean;
}

const navigation: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Financeiro", href: "/financeiro", icon: DollarSign, disabled: true },
  { label: "Estoque", href: "/estoque", icon: Package, disabled: true },
  { label: "Clientes", href: "/clientes", icon: Users, disabled: true },
  { label: "Fornecedores", href: "/fornecedores", icon: Truck, disabled: true },
  { label: "Projetos", href: "/projetos", icon: FolderKanban, disabled: true },
  { label: "Equipe", href: "/equipe", icon: UserCog, disabled: true },
  { label: "Documentos", href: "/documentos", icon: FileText, disabled: true },
  { label: "Notificações", href: "/notificacoes", icon: Bell, disabled: true },
  { label: "AI Hub", href: "/ai-hub/conteudo", icon: Sparkles, disabled: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useAppStore();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      {/* ── Logo ──────────────────────────────────────────── */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {sidebarOpen && (
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">Synapse</span>
          </Link>
        )}
        <button
          onClick={toggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label={sidebarOpen ? "Recolher menu" : "Expandir menu"}
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {/* ── Navegação ─────────────────────────────────────── */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.disabled ? "#" : item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground hover:bg-accent hover:text-foreground",
                item.disabled && "cursor-not-allowed opacity-40",
                !sidebarOpen && "justify-center px-0"
              )}
              onClick={(e) => item.disabled && e.preventDefault()}
              title={!sidebarOpen ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {sidebarOpen && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {item.badge}
                    </span>
                  )}
                  {item.disabled && (
                    <span className="text-[10px] text-muted-foreground">Em breve</span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────── */}
      <div className="border-t border-sidebar-border p-3">
        {sidebarOpen ? (
          <div className="flex items-center gap-3 rounded-md px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-bold">
              S
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium text-foreground truncate">Synapse</p>
              <p className="text-xs text-muted-foreground">Plano Starter</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-bold">
              S
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

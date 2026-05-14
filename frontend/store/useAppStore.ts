/**
 * Synapse — M1: Estado Global (Zustand)
 * Gerencia estado de autenticação, sidebar e notificações.
 */

import { create } from "zustand";
import type { Empresa, Usuario } from "@/types/auth";

interface AppState {
  // ── Autenticação ─────────────────────────────────────────
  usuario: Usuario | null;
  empresa: Empresa | null;
  loading: boolean;
  autenticado: boolean;
  setUsuario: (usuario: Usuario | null) => void;
  setLoading: (loading: boolean) => void;
  setAutenticado: (autenticado: boolean) => void;
  clearAuth: () => void;

  // ── Sidebar ──────────────────────────────────────────────
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // ── Notificações ─────────────────────────────────────────
  unreadNotifications: number;
  setUnreadNotifications: (count: number) => void;
}

const initialAuthState = {
  usuario: null as Usuario | null,
  empresa: null as Empresa | null,
  loading: false,
  autenticado: false,
};

export const useAppStore = create<AppState>((set) => ({
  // ── Auth ──────────────────────────────────────────────────
  ...initialAuthState,

  setUsuario: (usuario) =>
    set({
      usuario,
      empresa: usuario?.empresa ?? null,
    }),

  setLoading: (loading) => set({ loading }),

  setAutenticado: (autenticado) => set({ autenticado }),

  clearAuth: () => set({ ...initialAuthState }),

  // ── Sidebar ───────────────────────────────────────────────
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // ── Notificações ──────────────────────────────────────────
  unreadNotifications: 0,
  setUnreadNotifications: (count) => set({ unreadNotifications: count }),
}));

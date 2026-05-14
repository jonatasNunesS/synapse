/**
 * Synapse - Estado Global (Zustand)
 * Estado global mínimo: apenas dados que precisam ser compartilhados
 * entre componentes distantes na árvore.
 */

import { create } from "zustand";
import type { User, Empresa } from "@/types/api";

interface AppState {
  // ── Usuário ─────────────────────────────────────────────
  user: User | null;
  setUser: (user: User | null) => void;

  // ── Empresa ─────────────────────────────────────────────
  empresa: Empresa | null;
  setEmpresa: (empresa: Empresa | null) => void;

  // ── Sidebar ─────────────────────────────────────────────
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // ── Notificações ────────────────────────────────────────
  unreadNotifications: number;
  setUnreadNotifications: (count: number) => void;

  // ── Loading Global ──────────────────────────────────────
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // ── Reset ───────────────────────────────────────────────
  reset: () => void;
}

const initialState = {
  user: null,
  empresa: null,
  sidebarOpen: true,
  unreadNotifications: 0,
  isLoading: false,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setUser: (user) => set({ user }),
  setEmpresa: (empresa) => set({ empresa }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setUnreadNotifications: (count) => set({ unreadNotifications: count }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  reset: () => set(initialState),
}));

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
  //
  // DOIS estados, não um. `sidebarOpen` servia dois significados que
  // discordam exatamente no valor inicial: no desktop, "expandida" começa
  // ligada; no celular, "gaveta por cima da tela" nunca pode começar ligada.
  // Com uma flag só e o default `true`, todo carregamento no celular abria o
  // menu sobre o conteúdo — o bug mais antigo do sistema.
  /** Desktop: 256px (expandida) ou 64px (recolhida). */
  sidebarExpandida: boolean;
  alternarExpansao: () => void;
  /** Mobile: a gaveta está por cima da tela? Começa fechada, sempre. */
  gavetaAberta: boolean;
  setGavetaAberta: (aberta: boolean) => void;

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
  sidebarExpandida: true,
  alternarExpansao: () =>
    set((state) => ({ sidebarExpandida: !state.sidebarExpandida })),
  gavetaAberta: false,
  setGavetaAberta: (aberta) => set({ gavetaAberta: aberta }),

  // ── Notificações ──────────────────────────────────────────
  unreadNotifications: 0,
  setUnreadNotifications: (count) => set({ unreadNotifications: count }),
}));

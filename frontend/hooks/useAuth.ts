/**
 * Synapse - Hook de Autenticação
 * Gerencia login, logout, refresh e estado do usuário.
 * Placeholder para M0 - será completado no M1.
 */

"use client";

import { useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { User } from "@/types/api";

export function useAuth() {
  const { user, setUser, setEmpresa, reset } = useAppStore();

  const isAuthenticated = !!user;

  const login = useCallback(
    async (_email: string, _password: string): Promise<boolean> => {
      // TODO (M1): Implementar chamada real à API
      console.warn("useAuth.login: placeholder - será implementado no M1");
      return false;
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    // TODO (M1): Implementar chamada real à API
    reset();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, [reset]);

  const refreshUser = useCallback(async (): Promise<void> => {
    // TODO (M1): Buscar dados do usuário autenticado
    console.warn("useAuth.refreshUser: placeholder - será implementado no M1");
  }, []);

  return {
    user,
    isAuthenticated,
    login,
    logout,
    refreshUser,
  };
}

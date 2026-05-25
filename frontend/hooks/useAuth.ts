/**
 * Synapse — M1: Hook de Autenticação
 * Gerencia estado de auth com Zustand + chamadas à API.
 */

"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import api, { getErrorMessage } from "@/lib/api";
import type {
  AtualizarPerfilPayload,
  LoginPayload,
  RecuperarSenhaPayload,
  RedefinirSenhaPayload,
  RegistroPayload,
  Usuario,
} from "@/types/auth";

export function useAuth() {
  const router = useRouter();
  const {
    usuario,
    empresa,
    loading,
    autenticado,
    setUsuario,
    setLoading,
    setAutenticado,
    clearAuth,
  } = useAppStore();

  // ── Carregar usuário atual ─────────────────────────────────

  const carregarUsuario = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await api.get<Usuario>("/auth/me/");
      if (response.success && response.data) {
        setUsuario(response.data);
        setAutenticado(true);
        return true;
      }
      return false;
    } catch {
      clearAuth();
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setUsuario, setAutenticado, clearAuth]);

  // ── Login ──────────────────────────────────────────────────

  const login = useCallback(
    async (payload: LoginPayload): Promise<void> => {
      setLoading(true);
      try {
        const response = await api.post<{ usuario: Usuario }>("/auth/login/", payload);
        if (response.success && response.data.usuario) {
          setUsuario(response.data.usuario);
          setAutenticado(true);
          router.push("/");
        }
      } catch (error: unknown) {
        // Re-lança com mensagem útil para o componente de login exibir
        throw new Error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setUsuario, setAutenticado, router]
  );

  // ── Registro ───────────────────────────────────────────────

  const registro = useCallback(
    async (payload: RegistroPayload): Promise<void> => {
      setLoading(true);
      try {
        const response = await api.post<{ usuario: Usuario }>("/auth/registro/", payload);
        if (response.success && response.data.usuario) {
          setUsuario(response.data.usuario);
          setAutenticado(true);
          router.push("/?boas_vindas=1");
        }
      } catch (error: unknown) {
        // Re-lança com mensagem útil para o componente de registro exibir
        throw new Error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setUsuario, setAutenticado, router]
  );

  // ── Logout ─────────────────────────────────────────────────

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post("/auth/logout/");
    } catch {
      // Silencioso — limpa estado mesmo se a API falhar
    } finally {
      clearAuth();
      router.push("/login");
    }
  }, [clearAuth, router]);

  // ── Refresh silencioso ─────────────────────────────────────

  const refreshSilencioso = useCallback(async (): Promise<boolean> => {
    try {
      const response = await api.post("/auth/refresh/");
      return response.success;
    } catch {
      return false;
    }
  }, []);

  // ── Recuperar senha ────────────────────────────────────────

  const recuperarSenha = useCallback(
    async (payload: RecuperarSenhaPayload): Promise<string> => {
      const response = await api.post<null>("/auth/recuperar-senha/", payload);
      return response.message;
    },
    []
  );

  // ── Redefinir senha ────────────────────────────────────────

  const redefinirSenha = useCallback(
    async (payload: RedefinirSenhaPayload): Promise<void> => {
      await api.post("/auth/redefinir-senha/", payload);
      router.push("/login?senha_redefinida=1");
    },
    [router]
  );

  // ── Atualizar perfil ───────────────────────────────────────

  const atualizarPerfil = useCallback(
    async (payload: AtualizarPerfilPayload): Promise<void> => {
      const response = await api.patch<Usuario>("/auth/me/", payload);
      if (response.success && response.data) {
        setUsuario(response.data);
      }
    },
    [setUsuario]
  );

  return {
    usuario,
    empresa,
    loading,
    autenticado,
    carregarUsuario,
    login,
    registro,
    logout,
    refreshSilencioso,
    recuperarSenha,
    redefinirSenha,
    atualizarPerfil,
    getErrorMessage,
  };
}

/**
 * Synapse — M1: Hook de Autenticação
 * Gerencia estado de auth com Zustand + chamadas à API.
 */

"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import api, { getErrorMessage } from "@/lib/api";
import {
  limparTamanhoDoCookie,
  sincronizarTamanho,
} from "@/lib/preferencias";
import { limparTemaDoCookie, sincronizarTema } from "@/lib/tema";
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
        // Identidade visual da empresa: reaplica e guarda no cookie, para o
        // próximo carregamento já nascer na cor certa (sem flash).
        sincronizarTema(response.data.empresa);
        // Tamanho do texto é preferência de quem está logado, não da empresa.
        sincronizarTamanho(response.data.tamanho_fonte);
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
        // api.post<T> retorna ApiResponse<T>; response.data é o campo "data" do envelope
        const response = await api.post<{ usuario: Usuario }>("/auth/login/", payload);
        const usuario = response.data?.usuario;
        if (response.success && usuario) {
          setUsuario(usuario);
          setAutenticado(true);
          router.push("/dashboard");
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
        // api.post<T> retorna ApiResponse<T>; response.data é o campo "data" do envelope
        const response = await api.post<{ usuario: Usuario }>("/auth/registro/", payload);
        const usuario = response.data?.usuario;
        if (response.success && usuario) {
          setUsuario(usuario);
          setAutenticado(true);
          router.push("/dashboard?boas_vindas=1");
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
      // Máquina compartilhada: o próximo login não herda a cor da outra
      // empresa nem o tamanho de texto de outra pessoa.
      limparTemaDoCookie();
      limparTamanhoDoCookie();
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
    async (payload: RedefinirSenhaPayload, isConvite = false): Promise<void> => {
      await api.post("/auth/redefinir-senha/", payload);
      // Mesmo endpoint para reset e convite; muda só a mensagem no login
      router.push(
        isConvite ? "/login?primeiro_acesso=1" : "/login?senha_redefinida=1"
      );
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

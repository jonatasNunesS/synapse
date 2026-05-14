/**
 * Synapse - Cliente HTTP
 * Wrapper sobre fetch com tratamento de erros padrão,
 * autenticação JWT via httpOnly cookie e refresh automático.
 */

import type { ApiResponse, ApiError } from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Constrói a URL com query params.
   */
  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return url.toString();
  }

  /**
   * Requisição base com tratamento de erros.
   */
  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { params, ...fetchOptions } = options;
    const url = this.buildUrl(endpoint, params);

    const defaultHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const config: RequestInit = {
      ...fetchOptions,
      headers: {
        ...defaultHeaders,
        ...fetchOptions.headers,
      },
      credentials: "include", // Envia cookies httpOnly
    };

    try {
      const response = await fetch(url, config);

      // Token expirado - tenta refresh
      if (response.status === 401) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Repete a requisição original
          const retryResponse = await fetch(url, config);
          return await retryResponse.json();
        }
        // Refresh falhou - redireciona para login
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw data;
      }

      return data;
    } catch (error) {
      if ((error as ApiError)?.error?.code) {
        throw error;
      }
      throw {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Erro de conexão. Verifique sua internet.",
          details: {},
        },
      } as ApiError;
    }
  }

  /**
   * Tenta renovar o access token usando o refresh token.
   */
  private async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ── Métodos HTTP ──────────────────────────────────────────

  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET", params });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  /**
   * Upload de arquivo via FormData.
   */
  async upload<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    const response = await fetch(url, {
      method: "POST",
      body: formData,
      credentials: "include",
      // Não define Content-Type - o browser seta automaticamente com boundary
    });
    return await response.json();
  }
}

// Instância singleton
export const api = new ApiClient(API_BASE_URL);
export default api;

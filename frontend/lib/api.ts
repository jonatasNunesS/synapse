/**
 * Synapse — API Client (M1)
 * Wrapper sobre fetch com autenticação JWT via httpOnly cookie,
 * refresh automático em 401 e tratamento de erros padronizado.
 * Todas as requisições enviam credentials: "include".
 */

import type { ApiError, ApiResponse } from "@/types/api";

const API_BASE_URL =
  typeof window !== "undefined"
    ? "/api" // Browser: usa o proxy do Next.js (next.config.mjs)
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

// ── Controle de refresh (evita loop infinito) ────────────────
let isRefreshing = false;
type QueueItem = { resolve: () => void; reject: (e: unknown) => void };
const failedQueue: QueueItem[] = [];

function processQueue(error: unknown) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  failedQueue.length = 0;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
private buildUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  // 1. Garantir barra final no endpoint ANTES de adicionar query params
  let safeEndpoint = endpoint;
  if (!safeEndpoint.includes('?')) {
    safeEndpoint = safeEndpoint.endsWith('/') ? safeEndpoint : safeEndpoint + '/';
  } else {
    const [path, query] = safeEndpoint.split('?');
    safeEndpoint = (path.endsWith('/') ? path : path + '/') + '?' + query;
  }

  let url = `${this.baseUrl}${safeEndpoint}`;
  
  // 2. Adicionar params se existirem
  if (params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query.append(key, String(value));
      }
    });
    const queryString = query.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  return url;
}



  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { params, ...fetchOptions } = options;
     const url = this.buildUrl(endpoint, params);

    const config: RequestInit = {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...fetchOptions.headers,
      },
      credentials: "include",
    };

    const response = await fetch(url, config);

    // ── Refresh automático em 401 ──────────────────────────
    const isAuthRoute =
      endpoint.includes("/auth/refresh") ||
      endpoint.includes("/auth/login") ||
      endpoint.includes("/auth/registro");

    if (response.status === 401 && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise<ApiResponse<T>>((resolve, reject) => {
          failedQueue.push({
            resolve: () => this.request<T>(endpoint, options).then(resolve),
            reject,
          });
        });
      }

      isRefreshing = true;
      try {
        const refreshRes = await fetch(this.buildUrl("/auth/refresh/"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });

        if (!refreshRes.ok) throw new Error("Refresh failed");

        processQueue(null);
        isRefreshing = false;
        return this.request<T>(endpoint, options);
      } catch (err) {
        processQueue(err);
        isRefreshing = false;
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw {
          success: false,
          error: { code: "SESSION_EXPIRED", message: "Sessão expirada.", details: {} },
        } as ApiError;
      }
    }

    const data = await response.json();

    if (!response.ok) {
      throw data as ApiError;
    }

    return data as ApiResponse<T>;
  }

  // ── Métodos HTTP ───────────────────────────────────────────

  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET", params });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    const response = await fetch(url, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    return await response.json();
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;

// ── Helper: extrai mensagem de erro ───────────────────────────
export function getErrorMessage(error: unknown): string {
  const e = error as ApiError;
  if (e?.error?.message) return e.error.message;
  return "Ocorreu um erro inesperado.";
}

export function getFieldErrors(
  error: unknown
): Record<string, string[]> | null {
  const e = error as ApiError;
  if (e?.error?.details && Object.keys(e.error.details).length > 0) {
    return e.error.details as Record<string, string[]>;
  }
  return null;
}

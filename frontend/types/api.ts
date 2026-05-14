/**
 * Synapse - Tipos de Resposta da API
 * Padrão:
 * Sucesso: { success: true, data: T, message: string, pagination?: Pagination }
 * Erro: { success: false, error: { code: string, message: string, details: object } }
 */

export interface Pagination {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  next: string | null;
  previous: string | null;
}

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message: string;
  pagination?: Pagination;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

export type ApiResult<T = unknown> = ApiResponse<T> | ApiError;

/**
 * Tipos base compartilhados
 */
export interface BaseModel {
  id: number;
  criado_em: string;
  atualizado_em: string;
}

export interface TenantModel extends BaseModel {
  empresa_id: number;
}

/**
 * Empresa
 */
export interface Empresa extends BaseModel {
  nome: string;
  cnpj: string | null;
  segmento: string;
  plano: "starter" | "pro" | "business" | "enterprise";
  plano_ativo: boolean;
  plano_validade: string | null;
  ativo: boolean;
}

/**
 * Usuário
 */
export interface User extends BaseModel {
  email: string;
  nome: string;
  empresa_id: number;
  empresa: Empresa;
  perfil: "admin" | "gerente" | "colaborador";
  ativo: boolean;
}

/**
 * Health Check
 */
export interface HealthCheck {
  status: string;
  service: string;
}

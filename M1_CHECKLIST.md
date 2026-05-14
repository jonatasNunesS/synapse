# Synapse — M1 (Autenticação) · Checklist de Validação

> **Status:** ✅ Implementado e testado  
> **Data:** 2025  
> **Testes:** 65 passando (42 de auth + 23 do M0)  
> **Build Frontend:** ✅ Compilado sem erros

---

## 1. Backend — Modelos

| Item | Status |
|---|---|
| `Empresa` com UUID, segmento, plano, ativo, timestamps | ✅ |
| `CustomUser` com `empresa` FK, perfil, avatar_url, ativo | ✅ |
| `PasswordResetToken` com token_urlsafe(48), expira_em (2h), usado | ✅ |
| `AUTH_USER_MODEL = "synapse_auth.CustomUser"` | ✅ |
| Migration `synapse_auth.0001_initial` aplicada | ✅ |
| `token_blacklist` migrations aplicadas | ✅ |

---

## 2. Backend — Endpoints

| Endpoint | Método | Auth | Status |
|---|---|---|---|
| `POST /api/auth/registro/` | POST | Público | ✅ |
| `POST /api/auth/login/` | POST | Público | ✅ |
| `POST /api/auth/logout/` | POST | Autenticado | ✅ |
| `POST /api/auth/refresh/` | POST | Cookie | ✅ |
| `GET /api/auth/me/` | GET | Autenticado | ✅ |
| `PATCH /api/auth/me/` | PATCH | Autenticado | ✅ |
| `POST /api/auth/recuperar-senha/` | POST | Público | ✅ |
| `POST /api/auth/redefinir-senha/` | POST | Público | ✅ |

---

## 3. Backend — Segurança

| Item | Status |
|---|---|
| JWT em httpOnly cookie (access_token + refresh_token) | ✅ |
| Access token: 15 min · Refresh token: 7 dias | ✅ |
| Rotate refresh tokens + blacklist após rotação | ✅ |
| `CookieJWTAuthentication` (cookie-first, fallback header) | ✅ |
| Multi-tenant: `empresa_id` em todos os models de negócio | ✅ |
| Recuperação de senha não revela se e-mail existe | ✅ |
| Token de reset: 2h de validade, uso único | ✅ |
| Email de reset enviado via Celery (assíncrono) | ✅ |

---

## 4. Backend — Testes (42 testes de auth)

| Classe | Testes | Status |
|---|---|---|
| `TestRegistro` | 7 | ✅ |
| `TestLogin` | 6 | ✅ |
| `TestTokens` | 5 | ✅ |
| `TestLogout` | 3 | ✅ |
| `TestRecuperacaoSenha` | 7 | ✅ |
| `TestMultiTenant` | 2 | ✅ |
| `TestMe` | 5 | ✅ |
| `TestModels` | 7 | ✅ |

---

## 5. Frontend — Páginas

| Página | Rota | Status |
|---|---|---|
| Login | `/login` | ✅ |
| Registro | `/registro` | ✅ |
| Recuperar Senha | `/recuperar-senha` | ✅ |
| Redefinir Senha | `/redefinir-senha?token=...` | ✅ |

---

## 6. Frontend — Funcionalidades

| Item | Status |
|---|---|
| Validação com React Hook Form + Zod | ✅ |
| Exibição de erros do servidor | ✅ |
| Toggle de visibilidade de senha | ✅ |
| Middleware de proteção de rotas (Next.js) | ✅ |
| Redirect para `/login` se não autenticado | ✅ |
| Redirect para `/` se já autenticado | ✅ |
| Refresh automático em 401 (sem loop) | ✅ |
| Sidebar com nome/empresa/plano do usuário | ✅ |
| Header com avatar, nome e dropdown de logout | ✅ |
| Dashboard layout com loading state | ✅ |
| `useAppStore` com estado de auth (Zustand) | ✅ |
| `useAuth` hook completo (login/logout/registro/etc.) | ✅ |

---

## 7. Roteiro de Teste Manual

### 7.1 Registro
1. Acesse `http://localhost:3000/registro`
2. Preencha todos os campos com dados válidos
3. Clique em "Criar conta grátis"
4. **Esperado:** Redirecionamento para `/` com dashboard carregado

### 7.2 Login
1. Acesse `http://localhost:3000/login`
2. Use o e-mail e senha cadastrados
3. **Esperado:** Redirecionamento para `/` com nome do usuário na sidebar

### 7.3 Logout
1. No dashboard, clique no avatar no Header
2. Clique em "Sair da conta"
3. **Esperado:** Redirecionamento para `/login`

### 7.4 Proteção de Rota
1. Sem estar logado, acesse `http://localhost:3000/`
2. **Esperado:** Redirecionamento para `/login`

### 7.5 Recuperação de Senha
1. Acesse `/recuperar-senha`
2. Informe um e-mail cadastrado
3. **Esperado:** Mensagem de sucesso (e-mail enviado via Celery)
4. Use o token do e-mail em `/redefinir-senha?token=...`
5. **Esperado:** Redirecionamento para `/login?senha_redefinida=1`

### 7.6 Multi-Tenant
1. Cadastre duas empresas diferentes
2. Faça login com cada uma
3. **Esperado:** Cada usuário vê apenas os dados da sua empresa

---

## 8. Como Rodar

```bash
# Backend (com Docker)
docker-compose up -d

# Backend (local, para testes)
cd backend
DJANGO_SETTINGS_MODULE=config.settings.test python -m pytest tests/ -v

# Frontend
cd frontend
pnpm dev
```

---

## 9. Próximo Milestone

**M2 — Módulo Financeiro**
- Contas a pagar e receber
- Lançamentos e categorias
- Fluxo de caixa
- Relatórios financeiros com IA

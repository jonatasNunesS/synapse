# M0 — Fundação: Checklist de Validação

**Milestone:** M0 (Fundação)  
**Status:** ✅ Concluído  
**Data:** 2026-05-13  
**Repositório:** https://github.com/jonatasNunesS/synapse

---

## Roteiro de Teste para o Fundador

Siga este roteiro para validar o M0 localmente.

### 1. Clonar e Configurar

```bash
git clone https://github.com/jonatasNunesS/synapse.git
cd synapse
cp .env.example .env
```

### 2. Subir o Ambiente

```bash
docker-compose up -d
```

Aguarde cerca de 30 segundos para todos os serviços iniciarem.

### 3. Verificar Serviços

Acesse cada URL e confirme que está funcionando:

| Serviço | URL | Esperado |
|---------|-----|----------|
| Frontend | http://localhost:3000 | Dashboard Synapse (dark mode) |
| Backend API | http://localhost:8000/api/health/ | `{"success": true, "data": {"status": "ok"}}` |
| Django Admin | http://localhost:8000/admin/ | Tela de login do Django Admin |
| Flower (Celery) | http://localhost:5555 | Painel de monitoramento de tasks |
| pgAdmin | http://localhost:5050 | Interface do PostgreSQL |

### 4. Testar o Health Check

```bash
curl http://localhost:8000/api/health/
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "synapse-backend"
  },
  "message": "Synapse API está operacional."
}
```

**Testar que POST é rejeitado:**
```bash
curl -X POST http://localhost:8000/api/health/
```

**Resposta esperada:** HTTP 405 Method Not Allowed

### 5. Rodar os Testes do Backend

```bash
docker-compose exec backend pytest tests/ -v
```

**Resultado esperado:** 23 testes passando

```
tests/test_core.py::BaseEntityTests::test_base_entity_defaults PASSED
tests/test_core.py::BaseEntityTests::test_tenant_entity_has_empresa_id PASSED
tests/test_core.py::BaseEntityTests::test_tenant_entity_inherits_base PASSED
tests/test_core.py::EmpresaEntityTests::test_empresa_defaults PASSED
tests/test_core.py::EmpresaEntityTests::test_planos_validos PASSED
tests/test_core.py::EmpresaEntityTests::test_segmentos_validos PASSED
tests/test_core.py::UserEntityTests::test_perfis_validos PASSED
tests/test_core.py::UserEntityTests::test_user_defaults PASSED
tests/test_health.py::HealthCheckTests::test_health_check_only_get PASSED
tests/test_health.py::HealthCheckTests::test_health_check_response_format PASSED
tests/test_health.py::HealthCheckTests::test_health_check_returns_200 PASSED
tests/test_shared.py::ResponseHelpersTests::test_created_response_status_201 PASSED
tests/test_shared.py::ResponseHelpersTests::test_error_response_custom_status PASSED
tests/test_shared.py::ResponseHelpersTests::test_error_response_format PASSED
tests/test_shared.py::ResponseHelpersTests::test_success_response_format PASSED
tests/test_shared.py::CacheKeyTests::test_build_cache_key_deterministic PASSED
tests/test_shared.py::CacheKeyTests::test_build_cache_key_different_params PASSED
tests/test_shared.py::CacheKeyTests::test_build_cache_key_simple PASSED
tests/test_shared.py::CacheKeyTests::test_build_cache_key_with_params PASSED
tests/test_shared.py::ExceptionTests::test_format_error PASSED
tests/test_shared.py::ExceptionTests::test_resource_not_found PASSED
tests/test_shared.py::ExceptionTests::test_synapse_exception PASSED
tests/test_shared.py::ExceptionTests::test_tenant_access_denied PASSED
============================== 23 passed in 0.72s ==============================
```

### 6. Verificar o Frontend

Acesse http://localhost:3000 e verifique:

- [ ] Layout dark mode (fundo azul-escuro, sidebar roxa)
- [ ] Sidebar com todos os módulos listados
- [ ] Header com ícone de notificação e menu do usuário
- [ ] Card "Status do Sistema" mostrando API operacional (ponto verde pulsando)
- [ ] Roadmap de Milestones com M0 em "Em progresso"
- [ ] Responsivo em mobile (375px) — sidebar colapsa

### 7. Verificar Logs

```bash
docker-compose logs backend | head -20
```

Os logs devem estar em formato JSON estruturado.

---

## O que foi construído no M0

### Backend

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| Settings | `config/settings/base.py` | Configurações base (DB, Redis, JWT, Celery) |
| Settings Dev | `config/settings/development.py` | Debug toolbar, CORS permissivo |
| Settings Prod | `config/settings/production.py` | Segurança, HTTPS, HSTS |
| Settings Test | `config/settings/test.py` | SQLite em memória, cache local |
| Celery | `config/celery.py` | Configuração de tasks assíncronas |
| URLs | `config/urls.py` | Roteamento principal + health check |
| Pagination | `shared/pagination.py` | Paginação padrão (máx 25 itens) |
| Permissions | `shared/permissions.py` | Multi-tenant mixin |
| Exceptions | `shared/exceptions.py` | Handler customizado + exceções de domínio |
| Middleware | `shared/middleware.py` | Logging de requests |
| Responses | `shared/responses.py` | Helpers de resposta padrão |
| Cache | `shared/cache.py` | Utilitários de chave de cache |
| Entities | `core/entities/` | Dataclasses de domínio (Empresa, User, etc) |
| Interfaces | `core/interfaces/` | Contratos para cache, IA, scraping, storage |
| Redis Cache | `infrastructure/cache/redis_cache.py` | Implementação Redis |
| Local Storage | `infrastructure/storage/local_storage.py` | Storage local /media/ |
| Groq Client | `infrastructure/ia/groq_client.py` | Placeholder para M9 |
| Auth Model | `modules/auth/models.py` | CustomUser (placeholder para M1) |
| Testes | `tests/` | 23 testes cobrindo health, shared, core |

### Frontend

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| Layout Root | `app/layout.tsx` | HTML base com dark mode e Inter font |
| Dashboard Layout | `app/(dashboard)/layout.tsx` | Sidebar + Header |
| Dashboard Page | `app/(dashboard)/page.tsx` | Status API + Roadmap |
| Auth Layout | `app/(auth)/layout.tsx` | Layout centralizado para auth |
| Login Page | `app/(auth)/login/page.tsx` | Placeholder para M1 |
| Sidebar | `components/layout/Sidebar.tsx` | Navegação colapsável |
| Header | `components/layout/Header.tsx` | Notificações + menu usuário |
| Button | `components/ui/button.tsx` | Componente shadcn/ui |
| Card | `components/ui/card.tsx` | Componente shadcn/ui |
| API Client | `lib/api.ts` | Axios com interceptadores |
| App Store | `store/useAppStore.ts` | Zustand global state |
| Auth Hook | `hooks/useAuth.ts` | Hook de autenticação |
| Types | `types/api.ts` | TypeScript types da API |
| Tailwind | `tailwind.config.ts` | Tema dark mode Synapse |
| Next Config | `next.config.mjs` | Rewrites de API para backend |

### Infraestrutura

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| Docker Compose | `docker-compose.yml` | Orquestração: Django, Next.js, PostgreSQL, Redis, Celery, Flower, pgAdmin |
| Backend Dockerfile | `backend/Dockerfile` | Multi-stage build |
| Frontend Dockerfile | `frontend/Dockerfile` | Multi-stage build |
| .env.example | `.env.example` | Template de variáveis |
| .gitignore | `.gitignore` | Exclusões do Git |

---

## Critérios de Aceite do M0 ✅

- [x] Testa happy path (health check retorna 200 + JSON correto)
- [x] Testa dados inválidos (POST no health check retorna 405)
- [x] Cache implementado (Redis + utilitários de chave)
- [x] Multi-tenant validado (empresa_id em todas as entities)
- [x] Responsivo (375px e 1280px)
- [x] Repositório no GitHub: https://github.com/jonatasNunesS/synapse

---

## Próximo Passo: M1 — Autenticação

O M1 implementará:
- Registro de empresa + usuário admin
- Login com JWT em httpOnly cookie
- Refresh token automático
- Recuperação de senha via email (Resend)
- Middleware de autenticação no frontend
- Perfis de acesso (admin, gerente, colaborador)
- Testes completos de auth

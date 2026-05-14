# Synapse

**Synapse** é uma plataforma SaaS all-in-one de gestão empresarial com inteligência artificial, desenvolvida especificamente para empreendedores brasileiros. Oferece módulos integrados de financeiro, estoque, CRM, fornecedores, projetos, equipe e muito mais, com suporte a IA generativa via Groq API.

## 🎯 Visão Geral

Synapse segue uma **arquitetura em camadas** (Clean Architecture) com separação clara entre View, Service, Repository e Model. O projeto é estruturado como um **monorepo** contendo:

- **Backend**: Django 5 + DRF + PostgreSQL + Redis + Celery
- **Frontend**: Next.js 14 + TypeScript + Tailwind + shadcn/ui
- **Orquestração**: Docker Compose para desenvolvimento local

## 📁 Estrutura do Projeto

```
synapse/
├── backend/
│   ├── config/                    # Django settings (base/dev/prod/test) + Celery
│   ├── core/
│   │   ├── entities/              # Dataclasses de domínio (sem dependências externas)
│   │   └── interfaces/            # Interfaces para cache, IA, scraping, storage
│   ├── modules/                   # Um subpacote por módulo (auth, financeiro, etc)
│   │   └── {modulo}/
│   │       ├── models.py          # Django models
│   │       ├── serializers.py     # DRF serializers
│   │       ├── views.py           # ViewSets
│   │       ├── services.py        # Lógica de negócio
│   │       ├── repositories.py    # Queries ao banco
│   │       ├── tasks.py           # Tarefas Celery
│   │       └── tests/
│   ├── infrastructure/
│   │   ├── cache/                 # Redis cache
│   │   ├── ia/                    # Groq API client
│   │   ├── scraping/              # Web scraping
│   │   └── storage/               # Local file storage
│   ├── shared/                    # Pagination, permissions, exceptions, logging, middleware
│   ├── requirements/              # base.txt, development.txt, production.txt
│   ├── tests/                     # Testes globais (health check, shared utilities)
│   ├── manage.py
│   ├── pytest.ini
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── (auth)/                # Login, registro, recuperar-senha
│   │   └── (dashboard)/           # Layout + páginas por módulo
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── layout/                # Sidebar, Header
│   │   └── {modulo}/              # Componentes por módulo
│   ├── lib/
│   │   ├── api.ts                 # HTTP client com auth e error handling
│   │   ├── auth.ts                # Utilitários de autenticação
│   │   ├── cache.ts               # Cache local
│   │   └── utils.ts               # Funções auxiliares
│   ├── hooks/                     # Um hook por módulo
│   ├── store/                     # Zustand global state
│   ├── types/                     # TypeScript types
│   ├── tailwind.config.ts         # Tema dark mode Synapse
│   ├── next.config.mjs            # Configuração Next.js com rewrites de API
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml             # Orquestração local
├── .env.example                   # Template de variáveis de ambiente
├── .env                           # Variáveis de ambiente (local)
├── .gitignore
└── README.md
```

## 🏗️ Arquitetura

### Backend (Django)

A arquitetura segue **Clean Architecture** com camadas bem definidas:

```
View (ViewSet) → Service → Repository → Model (Django ORM)
```

**Regras Fixas:**
- Todo model com dados de negócio tem `empresa_id` (multi-tenant obrigatório)
- Todo GET de lista usa cache Redis: chave `synapse:{empresa_id}:{modulo}:{tipo}`
- Paginação obrigatória em listagens (máx 25 itens)
- IA e scraping **SEMPRE** via task Celery (nunca síncrono)
- Checar cache antes de chamar IA (TTL 24h por prompt)
- Zero secrets no código (sempre variáveis de ambiente via `.env`)
- JWT em httpOnly cookie (nunca localStorage)
- Storage de arquivos: pasta `/media/` local

### Frontend (Next.js)

- **Dark Mode**: Tema Synapse com azul-escuro (#0f172a) + roxo (#a78bfa)
- **Componentes**: shadcn/ui + Tailwind CSS
- **State Management**: Zustand para estado global
- **API Client**: Wrapper customizado com interceptadores de auth e erro
- **Responsividade**: Testada em 375px (mobile) e 1280px (desktop)

### API Response

**Sucesso:**
```json
{
  "success": true,
  "data": {},
  "message": "",
  "pagination": {}
}
```

**Erro:**
```json
{
  "success": false,
  "error": {
    "code": "",
    "message": "",
    "details": {}
  }
}
```

## 🚀 Milestones (Ordem Imutável)

| Milestone | Status | Descrição |
|-----------|--------|-----------|
| **M0** | ✅ Fundação | Monorepo, Docker Compose, health check, testes base |
| **M1** | ⏳ Autenticação | JWT, login/registro, recuperar-senha, 2FA |
| **M2** | ⏳ Financeiro | Receitas, despesas, fluxo de caixa, relatórios |
| **M3** | ⏳ Estoque | Produtos, categorias, movimentações, alertas |
| **M4** | ⏳ CRM Clientes | Contatos, propostas, histórico de vendas |
| **M5** | ⏳ Fornecedores | Cadastro, pedidos, avaliações |
| **M6** | ⏳ Projetos | Kanban, tarefas, timeline, colaboração |
| **M7** | ⏳ Equipe + Docs + Notificações | Usuários, permissões, documentos, alerts |
| **M8** | ⏳ Dashboard | KPIs, gráficos, insights |
| **M9** | ⏳ AI Hub | Análises com Groq, geração de conteúdo |

## 🛠️ Setup Local

### Pré-requisitos

- Docker e Docker Compose
- Python 3.11+ (para testes locais sem Docker)
- Node.js 22+ e pnpm

### Instalação

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/jonatasNunesS/synapse.git
   cd synapse
   ```

2. **Configure as variáveis de ambiente:**
   ```bash
   cp .env.example .env
   # Edite .env conforme necessário
   ```

3. **Inicie os serviços com Docker Compose:**
   ```bash
   docker-compose up -d
   ```

4. **Aguarde a inicialização:**
   - Backend: http://localhost:8000
   - Frontend: http://localhost:3000
   - Flower (Celery): http://localhost:5555
   - pgAdmin: http://localhost:5050

### Testes Locais (sem Docker)

**Backend:**
```bash
cd backend
pip install -r requirements/development.txt
DJANGO_SETTINGS_MODULE=config.settings.test pytest tests/ -v
```

**Frontend:**
```bash
cd frontend
pnpm install
pnpm build
```

## 📋 Variáveis de Ambiente

Veja `.env.example` para a lista completa. Principais:

```bash
# Django
DJANGO_SECRET_KEY=dev-secret-key-change-in-production-2026
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# PostgreSQL
POSTGRES_DB=synapse
POSTGRES_USER=synapse
POSTGRES_PASSWORD=synapse_dev_2026

# Redis
REDIS_URL=redis://redis:6379/0

# Celery
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# IA (M9)
GROQ_API_KEY=

# Email (M1)
RESEND_API_KEY=
```

## 🧪 Testes

### M0 - Testes Implementados

**Backend (23 testes):**
- ✅ Health check (GET /api/health/)
- ✅ Response helpers (success, created, error)
- ✅ Cache key generation
- ✅ Custom exceptions
- ✅ Core entities (Empresa, User, Base)

**Frontend:**
- ✅ TypeScript compilation
- ✅ Next.js build
- ✅ ESLint validation

**Rodar testes:**
```bash
# Backend
cd backend
DJANGO_SETTINGS_MODULE=config.settings.test pytest tests/ -v

# Frontend
cd frontend
pnpm build
```

## 📦 Dependências Principais

### Backend
- Django 5.1
- Django REST Framework
- djangorestframework-simplejwt (JWT)
- django-cors-headers
- django-redis
- Celery + Redis
- psycopg2-binary (PostgreSQL)
- python-decouple (env vars)
- python-json-logger (JSON logging)

### Frontend
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui
- Zustand
- lucide-react (icons)

## 🔄 Workflow de Desenvolvimento

Para cada novo milestone, seguir a ordem:

1. **Model** → Criar Django models com `empresa_id`
2. **Repository** → Implementar queries com cache
3. **Service** → Lógica de negócio
4. **View** → ViewSets + serializers
5. **Teste** → Cobertura de happy path, dados inválidos, acesso negado
6. **Frontend** → Componentes, hooks, integração com API

**Checklist antes de marcar como pronto:**
- ✅ Testa happy path
- ✅ Testa dados inválidos
- ✅ Testa acesso negado (multi-tenant)
- ✅ Cache implementado
- ✅ Multi-tenant validado
- ✅ Responsivo (375px e 1280px)

## 🚢 Deploy

### Produção (Railway + Vercel)

**Backend (Railway):**
- Usar `requirements/production.txt`
- Settings: `config.settings.production`
- Variáveis de ambiente via Railway dashboard
- Database: PostgreSQL gerenciado
- Cache: Redis gerenciado

**Frontend (Vercel):**
- Deploy automático via GitHub
- Variáveis de ambiente: `NEXT_PUBLIC_API_URL` apontando para Railway

## 📝 Logging

Logs estruturados em JSON via `python-json-logger`:

```json
{
  "timestamp": "2026-05-13T20:30:00Z",
  "level": "INFO",
  "logger": "synapse.modules.financeiro",
  "message": "Receita criada",
  "empresa_id": 1,
  "user_id": 5
}
```

## 🔐 Segurança

- **Secrets**: Sempre via `.env`, nunca hardcoded
- **CORS**: Configurado por ambiente
- **JWT**: httpOnly cookies, sem localStorage
- **Multi-tenant**: Middleware valida `empresa_id` em todas as requests
- **HTTPS**: Obrigatório em produção

## 📞 Suporte

Para dúvidas ou issues, abra uma issue no GitHub ou contate o time de desenvolvimento.

---

**Versão:** M0 (Fundação)  
**Última atualização:** 2026-05-13  
**Desenvolvedor:** Manus AI

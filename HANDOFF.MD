═══════════════════════════════════════════════════════════════
SYNAPSE — HANDOFF COMPLETO PARA O CLAUDE CODE
═══════════════════════════════════════════════════════════════

Você está assumindo o desenvolvimento e manutenção do Synapse,
um SaaS all-in-one de gestão empresarial com IA para
empreendedores brasileiros. Leia tudo antes de agir.

───────────────────────────────────────────────────────────────
1. PRIMEIRA AÇÃO — ENTENDER O ESTADO REAL
───────────────────────────────────────────────────────────────

Antes de qualquer alteração, execute e analise:

git log --oneline -20
git status
git branch -a

Confirme em qual commit o repositório está.

BASELINE OFICIAL (estado estável):
e26b9dade4479b4b41aa3ea01cd39bd08d128b29
"Merge PR #1 — fix: corrigir crash AI Hub, adicionar
 gerenciamento de categorias"

Se o repositório NÃO estiver neste commit ou descendente
limpo dele, PARE e me avise antes de continuar.

───────────────────────────────────────────────────────────────
2. O QUE É O SYNAPSE
───────────────────────────────────────────────────────────────

SaaS de gestão empresarial. Módulos: Financeiro, Estoque, CRM,
Fornecedores, Projetos, Equipe, Documentos, Notificações,
Dashboard, AI Hub. Multi-tenant (cada empresa isolada).

Casos piloto: loja de camisas + Impactar Cerimonial.

STACK:
Backend : Django 5 + DRF + PostgreSQL + Redis + Celery
Frontend: Next.js + TypeScript + Tailwind + shadcn/ui
IA      : Groq API (LLaMA 3.3 70B + 3.1 8B)
Infra   : Docker Compose (local, sem deploy em nuvem ainda)
E-mail  : Resend | Storage: /media/ local

───────────────────────────────────────────────────────────────
3. ARQUITETURA (NUNCA QUEBRAR)
───────────────────────────────────────────────────────────────

Clean Architecture em camadas:
  View → Service → Repository → Model

- View: só recebe e devolve. Zero lógica de negócio.
- Service: toda a lógica. Métodos estáticos.
- Repository: todas as queries ao banco. Cache aplicado aqui.
- Model: estrutura de dados.

Estrutura de cada módulo (backend/modules/{modulo}/):
  models.py, serializers.py, views.py, urls.py,
  services.py, repository.py, tasks.py, admin.py, apps.py

REGRAS INVIOLÁVEIS:
- Todo model de negócio tem empresa_id (multi-tenant)
- Views herdam EmpresaQuerySetMixin (shared/permissions.py)
- Todo endpoint usa CookieJWTAuthentication + IsEmpresaMember
- GET de lista usa cache Redis: synapse:{empresa_id}:{modulo}:{tipo}
- Paginação obrigatória (max 25 itens)
- IA e scraping sempre via Celery (nunca síncrono)
- JWT em httpOnly cookie (nunca localStorage)
- Movimentações de estoque são imutáveis (só estorno)
- Zero secrets no código (tudo em variáveis de ambiente)

PADRÃO DE RESPOSTA DA API:
Sucesso: {"success": true, "data": {...}, "message": "",
          "pagination": {...}}
Erro:    {"success": false, "error": {"code": "",
          "message": "", "details": {}}}

A documentação técnica completa do backend está no
Google Drive: "Synapse — 06. Documentação Técnica do Backend"
(estrutura real gerada a partir do código).

───────────────────────────────────────────────────────────────
4. HISTÓRICO DO PROJETO
───────────────────────────────────────────────────────────────

O sistema foi construído em 9 milestones (M0 a M9):
M0 Fundação, M1 Auth, M2 Financeiro, M3 Estoque, M4 CRM,
M5 Fornecedores, M6 Projetos, M7 Equipe+Docs+Notificações,
M8 Dashboard, M9 AI Hub.

No pico chegou a ~532 testes passando. Passou por várias
auditorias de código que encontraram e corrigiram dezenas
de bugs (Bug A: res.data.data → res.data em hooks; bugs de
segurança: refresh token blacklist, throttling, XSS em
mensagens, race condition em caixinhas; bugs de build:
NEXT_PUBLIC_BACKEND_URL ausente no Dockerfile).

EVENTO IMPORTANTE — REVERSÃO DO LOTE 4:
As features do "Lote 4 / roadmap" (Agenda, Mensagens,
Caixinhas, Investimentos, filtros CRM, compra→estoque)
vieram cheias de bugs e foram REVERTIDAS. O repositório
foi realinhado ao baseline e26b9da em 12/06/2026.

O código revertido está preservado na branch:
backup/lote4-bugado-2026-06-06
(consulta de referência apenas — NUNCA mergear)

───────────────────────────────────────────────────────────────
5. O QUE O BASELINE CONTÉM (válido)
───────────────────────────────────────────────────────────────

✅ Todos os módulos M0–M9 funcionais
✅ AI Hub com crash corrigido (InsightCard null-safe)
✅ Gerenciamento de categorias (estoque/fornecedores/financeiro)
✅ Busca global (módulo search)

NÃO contém (revertido, não reintroduzir sem aprovação):
❌ Agenda, Mensagens, Caixinhas, Investimentos,
   filtros CRM por período, compra→estoque

───────────────────────────────────────────────────────────────
6. PROBLEMA ATUAL A RESOLVER (PRIORIDADE)
───────────────────────────────────────────────────────────────

Sintoma relatado pelo Fundador:
"Os GETs não retornam dados (financeiro, estoque, todos os
módulos). Não consigo editar nem apagar nada em nenhuma função."

GET, PATCH e DELETE falhando juntos em todos os módulos
sugere CAUSA-RAIZ ÚNICA. Suspeitas prováveis (investigar
nesta ordem):

1. Build do frontend desatualizado / proxy quebrado
   - next.config.mjs: backendUrl pode estar "undefined"
   - Verificar NEXT_PUBLIC_BACKEND_URL no Dockerfile e compose
   - Rodar: docker compose build frontend --no-cache

2. Autenticação / cookies JWT
   - Cookies access_token/refresh_token presentes?
   - Token expirado sem refresh automático?
   - CookieJWTAuthentication lendo o cookie?

3. Bug A residual (res.data.data em vez de res.data)
   - Verificar todos os hooks: useFinanceiro, useEstoque,
     useClientes, useFornecedores, useProjetos, etc.

DIAGNÓSTICO RECOMENDADO:
a) docker compose ps (todos os serviços up?)
b) curl direto na API com cookie (isola backend do frontend)
c) DevTools → Network no browser (ver status real dos requests)
d) docker compose logs backend --tail=50

Comece pelo diagnóstico ANTES de alterar código.
Identifique a causa-raiz, depois corrija na origem.

───────────────────────────────────────────────────────────────
7. DEFINITION OF DONE (toda alteração)
───────────────────────────────────────────────────────────────

Antes de considerar qualquer tarefa concluída:
✅ pytest tests/ -v → todos passando
✅ npx tsc --noEmit → exit 0
✅ docker compose build → sem erros
✅ Testado manualmente no browser (happy path +
   dados inválidos + acesso negado)
✅ Multi-tenant validado (empresa_id filtrado)
✅ Commit com mensagem descritiva
   formato: tipo(modulo): descrição

───────────────────────────────────────────────────────────────
8. REGRAS DE TRABALHO
───────────────────────────────────────────────────────────────

- Nunca fazer push no master sem confirmar comigo
- Features novas: branch feature/<nome>, uma de cada vez,
  com testes antes de qualquer merge
- Correções: pode trabalhar direto, mas sempre com testes
- Sempre rodar pytest + tsc antes de commitar
- Se algo parecer arriscado ou ambíguo, me pergunte antes
- Preservar a arquitetura Clean (View→Service→Repository→Model)

───────────────────────────────────────────────────────────────
PRIMEIRA TAREFA:
Faça o diagnóstico da seção 6 (GET/PATCH/DELETE quebrados),
identifique a causa-raiz e me apresente o que encontrou
ANTES de corrigir. Quero entender o problema antes da solução.
═══════════════════════════════════════════════════════════════
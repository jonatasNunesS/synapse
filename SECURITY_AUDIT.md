# 🔒 Auditoria de Segurança — Synapse

**Data:** 2026-08-15
**Escopo:** Backend Django 5.1.5 + DRF, Frontend Next.js 16, arquitetura multi-tenant (SaaS).
**Natureza desta branch:** auditoria — **nenhum código de produção foi alterado**. O único artefato é este documento. As correções são decisão da fase 2.
**Metodologia:** leitura de código (views, services, repositories, permissions, settings, Docker), varredura de padrões (IDOR, SQL raw, XSS, segredos, mass assignment), e execução de `pip-audit` (backend) + `pnpm audit` (frontend).

---

## 1. Resumo Executivo

| Nível | Qtd |
|-------|-----|
| 🔴 Crítico | **0** |
| 🟠 Alto | **3** |
| 🟡 Médio | **5** |
| 🔵 Baixo | **5** |

### Os pontos mais urgentes (o que mais pesa)

1. **Dependências desatualizadas com CVEs conhecidas** — a base Django/PyJWT/SimpleJWT (camada de framework **e de autenticação**) e o Next.js do frontend têm vulnerabilidades publicadas. `pip-audit`: **63** ocorrências (Django 26, Pillow 24, PyJWT 12). `pnpm audit`: **47** (1 crítica, 25 altas). É o **bloqueador nº 1** de lançamento. → `ALTO-01`
2. **Empresa suspensa é bloqueada apenas no frontend** — o backend deixa uma empresa suspensa (inadimplente/banida) continuar operando via chamada direta à API. Bypass de cobrança/suspensão. → `ALTO-02`
3. **Endpoints sensíveis sem rate limiting** — `recuperar-senha`, `registro` e `redefinir-senha` não têm throttle. Permite email bombing (queima de quota do Resend), criação ilimitada de tenants e tentativas ilimitadas de token. → `ALTO-03`
4. **Upload de arquivos sem validação de tipo/tamanho** no módulo de documentos — risco de DoS de disco e armazenamento de conteúdo perigoso. → `MED-01`
5. **Headers de segurança ausentes em produção** — sem HSTS, sem Content-Security-Policy, sem Referrer-Policy. → `MED-02`

### Veredito: **dá para publicar hoje?**

**Não como está — mas está perto.** A fundação de segurança é sólida: **isolamento multi-tenant consistente, zero IDOR nos endpoints expostos, zero segredos commitados, autenticação bem construída (JWT em cookie httpOnly + rotação + blacklist)**. Não há nenhum achado **crítico**.

O que **precisa** ser resolvido antes de abrir para clientes reais são os **3 ALTOs** — em especial atualizar as dependências (ALTO-01) e fechar o bypass da empresa suspensa (ALTO-02), que são mecânicos e de baixo risco de regressão. Os MÉDIOs de upload e headers (MED-01, MED-02) são fortemente recomendados no mesmo ciclo. Feito isso, o sistema está em condição de lançamento.

---

## 2. Achados por nível

### 🟠 ALTO

---

#### ALTO-01 — Dependências com vulnerabilidades conhecidas (framework + autenticação)

- **Nível:** 🟠 Alto (algumas CVEs subjacentes são graves; exploração depende do CVE específico)
- **Local:** `backend/requirements/base.txt`, `frontend/package.json`
- **Descrição:** As bibliotecas centrais estão em versões com CVEs publicadas.

  **Backend (`pip-audit` sobre `requirements/production.txt` — 63 ocorrências):**

  | Pacote | Versão | Vulns | Corrigido em |
  |--------|--------|-------|--------------|
  | `django` | 5.1.5 | 26 | ≥ 5.1.15 (série 5.1) / 5.2.x |
  | `pillow` | 11.1.0 | 24 | ≥ 12.x |
  | `pyjwt` | 2.10.1 | 12 | ≥ 2.13.0 |
  | `djangorestframework-simplejwt` | 5.4.0 | 1 | ≥ 5.5.1 |

  **Frontend (`pnpm audit` — 47 vulns: 1 crítica, 25 altas, 21 moderadas):**

  | Pacote | Situação | Corrigido em |
  |--------|----------|--------------|
  | `next` | 16.2.6, várias advisories | ≥ 16.2.11 |
  | `axios` | 1.16.0 (prototype pollution / auth injection) | ≥ 1.18.0 |
  | `postcss` | leitura de arquivos `.map` arbitrários | ≥ 8.5.23 |
  | `sharp`/`libvips` | vulnerabilidades herdadas | atualizar |
  | `vitest` | **crítica** — leitura/execução de arquivo arbitrário quando o UI server escuta | ≥ 3.2.6 *(dev-only)* |
  | `glob` | command injection via `-c/--cmd` | atualizar *(dev/CLI)* |

- **Cenário de exploração:** As mais preocupantes são as da camada de **autenticação** (`pyjwt`, `simplejwt`) e do **framework web** (`django`, `next`), por serem alcançáveis pela internet. Uma CVE de verificação de assinatura em PyJWT ou de parsing em Django, se o caminho vulnerável for atingível, pode levar a bypass de auth, DoS ou vazamento. A crítica do `vitest` é **dev-only** (não vai para produção), mas deve sair do lockfile ainda assim.
- **Correção recomendada:** Subir Django para a última 5.1.x (ou 5.2.x LTS), PyJWT ≥ 2.13, SimpleJWT ≥ 5.5.1, Pillow ≥ 12.x; no frontend, `next` ≥ 16.2.11, `axios` ≥ 1.18, `postcss` ≥ 8.5.23. Rodar a suíte de testes após cada bump. Adotar `pip-audit`/`pnpm audit` no CI para não reincidir.
- **Esforço:** Médio (½–1 dia, incluindo regressão).

---

#### ALTO-02 — Empresa suspensa é bloqueada apenas no frontend

- **Nível:** 🟠 Alto
- **Local:** `backend/modules/auth/services.py:93-94`; ausência de enforcement em `backend/shared/permissions.py` / `backend/shared/modulos.py`.
- **Descrição:** Ao suspender uma empresa (`empresa.status = "suspensa"`, feito em `painel_admin/services.py:151`), o login **continua funcionando** por decisão de produto — o próprio código comenta: *"Empresa suspensa NÃO bloqueia o login: o usuário entra, mas o front exibe a tela de aviso… e não deixa operar."* O bloqueio de operação vive **apenas no frontend**. Nenhuma permission do backend (`IsEmpresaMember`, `ModuloAtivo`, etc.) verifica `empresa.status`.
- **Cenário de exploração:** Uma empresa suspensa por inadimplência (ou por abuso) autentica normalmente, obtém o cookie JWT válido e chama qualquer endpoint de negócio diretamente (`POST /api/financeiro/lancamentos/`, etc.), ignorando a tela de aviso. O usuário continua usando o produto pago sem pagar / apesar do banimento.
- **Correção recomendada:** Adicionar uma permission de backend (ex.: `EmpresaAtiva`) que rejeite (`403`) requisições de escrita — ou toda operação de negócio — quando `request.user.empresa.status == "suspensa"`, mantendo liberados apenas `/auth/me`, logout e endpoints de billing/reativação. Aplicá-la nas views de negócio (idealmente no mixin/base compartilhado).
- **Esforço:** Baixo (uma permission + inclusão nas views base).

---

#### ALTO-03 — Endpoints sensíveis sem rate limiting

- **Nível:** 🟠 Alto
- **Local:** `backend/modules/auth/views.py` — `RegistroView` (linha 73), `RecuperarSenhaView` (227), `RedefinirSenhaView` (255). Config global em `backend/config/settings/base.py:176-184`.
- **Descrição:** O throttling global usa **apenas `ScopedRateThrottle`** — ou seja, só limita views que declaram `throttle_scope`. Apenas `LoginView` (`login`, 5/min) e as views de IA (`ai_gerar`, 10/min) declaram escopo. Registro, recuperação e redefinição de senha ficam **sem limite algum**. Não há `AnonRateThrottle`/`UserRateThrottle` global de fallback.
- **Cenário de exploração:**
  - `recuperar-senha`: um atacante dispara milhares de requisições com o email da vítima → **email bombing** na caixa dela e **queima da quota do Resend** (custo/bloqueio do provedor de email). Também gera tokens em massa.
  - `registro`: criação ilimitada e automatizada de empresas/usuários (spam de tenants, poluição de dados, custo).
  - `redefinir-senha`: tentativas ilimitadas de token. *(Mitigado pela entropia do token — 48 bytes `secrets.token_urlsafe` — mas a ausência de limite é um antipadrão.)*
- **Correção recomendada:** Declarar `throttle_scope` nessas três views (ex.: `recuperar_senha` 3/min por IP, `registro` 5/hora por IP, `redefinir_senha` 10/min) e/ou adicionar `AnonRateThrottle` global como rede de segurança. Nota: `ScopedRateThrottle` no login usa a chave por IP — validar que o rate limit não é contornável atrás do proxy (confiar em `X-Forwarded-For` corretamente).
- **Esforço:** Baixo (adicionar escopos + rates).

---

### 🟡 MÉDIO

---

#### MED-01 — Upload de arquivos sem validação de tipo/tamanho

- **Nível:** 🟡 Médio
- **Local:** `backend/modules/documentos/models.py:37` e `:84` — `arquivo = models.FileField(upload_to=..., null=True, blank=True)` sem `validators`.
- **Descrição:** Os `FileField` de documentos e versões não têm validação de extensão, MIME ou tamanho. Não há `FILE_UPLOAD_MAX_MEMORY_SIZE` customizado (o default do Django cobre parcialmente o buffer em memória, mas não o tamanho do arquivo persistido nem o tipo).
- **Cenário de exploração:** Um usuário autenticado sobe arquivos gigantes repetidamente → **DoS de disco**. Sobe executáveis/scripts/HTML → armazenamento de conteúdo perigoso. *Mitigação existente:* o download (`DocumentoDownloadView`) usa `FileResponse(as_attachment=True)`, o que neutraliza o vetor de XSS armazenado (o browser baixa em vez de renderizar). O risco residual é DoS/abuso de armazenamento e distribuição de conteúdo.
- **Correção recomendada:** Adicionar `FileExtensionValidator` com allowlist, validar `content_type` e impor um limite de tamanho no serializer/model. Definir `DATA_UPLOAD_MAX_MEMORY_SIZE`/`FILE_UPLOAD_MAX_MEMORY_SIZE` explícitos.
- **Esforço:** Baixo.

---

#### MED-02 — Headers de segurança ausentes em produção

- **Nível:** 🟡 Médio
- **Local:** `backend/config/settings/production.py` (linhas 28-33).
- **Descrição:** Produção define `SECURE_CONTENT_TYPE_NOSNIFF`, `SECURE_BROWSER_XSS_FILTER`, `SECURE_SSL_REDIRECT` e `X_FRAME_OPTIONS="DENY"`, mas **não define**:
  - `SECURE_HSTS_SECONDS` (+ `INCLUDE_SUBDOMAINS`/`PRELOAD`) — sem HSTS, a primeira visita fica exposta a downgrade/SSL-strip.
  - `Content-Security-Policy` — sem CSP, defesa em profundidade contra XSS ausente.
  - `SECURE_REFERRER_POLICY`.
- **Cenário de exploração:** Sem HSTS, um atacante em posição de rede pode tentar rebaixar a conexão para HTTP na primeira visita. Sem CSP, qualquer XSS que passe (hoje não identificado) tem impacto máximo.
- **Correção recomendada:** Adicionar `SECURE_HSTS_SECONDS = 31536000`, `SECURE_HSTS_INCLUDE_SUBDOMAINS = True`, `SECURE_HSTS_PRELOAD = True`, `SECURE_REFERRER_POLICY = "same-origin"` e uma CSP (via `django-csp` ou header no WhiteNoise/proxy). Validar HSTS só depois de confirmar HTTPS em todos os subdomínios.
- **Esforço:** Baixo.

---

#### MED-03 — Contabilidade de créditos de IA apenas em cache volátil

- **Nível:** 🟡 Médio
- **Local:** `backend/modules/ai_hub/creditos.py` (`reservar`/`_usado`/`devolver`).
- **Descrição:** O consumo de créditos de IA é contado **exclusivamente no Redis** (`cache.incr` com TTL até a meia-noite). O design da reserva é bom — atômico via `INCR`, cobra antes de chamar a IA, estorna em falha. Mas o contador **não é durável**: um flush/restart do Redis zera o consumo do dia.
- **Cenário de exploração:** Se o Redis reiniciar ou for limpo (deploy, manutenção, OOM), todas as empresas recuperam o limite diário integral — créditos "grátis" e custo extra de API da Groq. Menor: `devolver` usa `get`+`set` (read-modify-write não atômico), com pequena janela de corrida no estorno.
- **Correção recomendada:** Persistir o consumo confirmado em banco (ou um contador durável) e usar o cache só como camada rápida; ou aceitar o risco explicitamente se o volume/custo for baixo. Trocar o `get/set` de `devolver` por `decr` atômico com piso em zero.
- **Esforço:** Médio.

---

#### MED-04 — Infra de desenvolvimento exposta sem autenticação (docker-compose)

- **Nível:** 🟡 Médio *(contexto: compose de dev/local — não é o deploy de produção, que roda em Render)*
- **Local:** `docker-compose.yml`.
- **Descrição:** O compose sobe vários serviços com portas publicadas no host e sem/ com autenticação fraca:
  - **Redis** (`6379:6379`) **sem senha** (`requirepass`).
  - **PostgreSQL** (`5432:5432`) com senha default `synapse_dev_2026`.
  - **pgAdmin** (`5050:80`) com senha default `admin`.
  - **Flower** (`5555:5555`), painel de monitoramento do Celery, **sem autenticação**.
- **Cenário de exploração:** Se esse compose for executado numa VPS/host com IP público e as variáveis default, qualquer um na rede acessa Redis (que guarda sessões/cache/créditos), Postgres, o pgAdmin e o Flower. Em `localhost` de dev o risco é baixo; o problema é reuso indevido em ambiente exposto.
- **Correção recomendada:** Documentar que o compose é **somente dev**; para qualquer ambiente compartilhado, não publicar as portas de infra no host, exigir senha no Redis, remover pgAdmin/Flower ou protegê-los, e nunca usar as senhas default.
- **Esforço:** Baixo.

---

#### MED-05 — Dockerfile do backend constrói imagem de desenvolvimento

- **Nível:** 🟡 Médio
- **Local:** `backend/Dockerfile`.
- **Descrição:** O único Dockerfile do backend fixa `DJANGO_SETTINGS_MODULE=config.settings.development`, instala `requirements/development.txt` (com debug-toolbar, ipython) e o `CMD` roda `manage.py runserver` — servidor de desenvolvimento. Além disso, roda como **root** (sem `USER`).
- **Cenário de exploração:** Se essa imagem for usada em produção, o app roda com DEBUG/dev server (sem performance nem hardening de prod) e como root. *Observação:* a presença de `requirements/production.txt` (gunicorn + WhiteNoise + Sentry) sugere que produção usa outro caminho (Render/gunicorn) — **confirmar** que o deploy real não usa este Dockerfile.
- **Correção recomendada:** Criar um estágio/Dockerfile de produção (gunicorn, `settings.production`, usuário não-root) ou documentar claramente que este arquivo é dev-only. Adicionar `USER` não-root em ambos os Dockerfiles (backend e frontend rodam como root hoje).
- **Esforço:** Baixo/Médio.

---

### 🔵 BAIXO

---

#### BAIXO-01 — Senhas default fracas em fallbacks

- **Local:** `backend/config/settings/base.py` (`POSTGRES_PASSWORD` default `synapse_dev_2026`), `docker-compose.yml` (pgAdmin `admin`).
- **Descrição:** Fallbacks de dev com senhas fracas/previsíveis. Aceitável em dev; perigoso se algum ambiente subir sem sobrescrever as variáveis. Recomenda-se **não** ter default para credenciais (falhar se ausente), como já é feito corretamente com `DJANGO_SECRET_KEY`.

#### BAIXO-02 — `update()` interno sem escopo explícito de empresa

- **Local:** `backend/modules/clientes/repository.py:355` — `Cliente.objects.filter(pk=cliente_id).update(...)`.
- **Descrição:** Recompute interno de estatísticas do cliente filtra só por `pk`, sem `empresa_id`. Não é IDOR request-facing (o `cliente_id` vem de contexto já escopado e só atualiza campos derivados), mas por **defesa em profundidade** convém adicionar `empresa_id` ao filtro.

#### BAIXO-03 — Import dinâmico ofuscado no módulo de busca

- **Local:** `backend/modules/search/views.py:79-81` — `__import__("django.db.models", fromlist=["Q"]).Q(...)`.
- **Descrição:** Não é vulnerabilidade (o termo passa pelo `Q`/ORM, parametrizado). É só legibilidade — trocar por um `from django.db.models import Q` no topo.

#### BAIXO-04 — `CSRF_TRUSTED_ORIGINS` não configurado

- **Local:** `backend/config/settings/production.py`.
- **Descrição:** A API usa JWT em cookie (não `SessionAuthentication`), então o CSRF do DRF não se aplica e o `SameSite=Lax` protege as chamadas de negócio. Porém o **Django admin** usa sessão+CSRF; atrás de proxy HTTPS pode precisar de `CSRF_TRUSTED_ORIGINS` para funcionar/ficar seguro. Configurar se o admin for exposto.

#### BAIXO-05 — Falta de limites explícitos de upload no settings

- **Local:** `backend/config/settings/base.py`.
- **Descrição:** Complementa MED-01. Definir `DATA_UPLOAD_MAX_MEMORY_SIZE` e `FILE_UPLOAD_MAX_MEMORY_SIZE` de forma explícita (em vez de depender do default) deixa a política de tamanho clara e auditável.

---

## 3. O que está bem (fundação sólida)

Vale registrar — a maioria do que se auditou está **bem feito**, e isso reduz muito o risco geral:

- ✅ **Isolamento multi-tenant consistente.** `EmpresaQuerySetMixin` filtra `get_queryset` por `empresa_id`, injeta `empresa_id` no create e oferece `check_tenant_ownership`. Os repositories reforçam com filtros explícitos por `empresa_id` (documentos, financeiro, ai_hub, clientes, etc.).
- ✅ **Zero IDOR nos endpoints expostos.** Download de documentos (`DocumentoDownloadView` → repo escopado), polling de tasks de IA (`TaskIA.objects.get(pk=..., empresa_id=...)`), e todas as views financeiras usam `_get_lancamento(empresa_id, pk)`. Varredura por `objects.get(pk=)`/`get_object_or_404` sem escopo não encontrou nada request-facing explorável.
- ✅ **Autenticação bem construída.** JWT em cookie **httpOnly** + **Secure** (produção) + **SameSite=Lax**; `CookieJWTAuthentication` própria; access 15 min, refresh 7 dias com **rotação** (`ROTATE_REFRESH_TOKENS`) e **blacklist** (`BLACKLIST_AFTER_ROTATION`). Nenhum token em `localStorage` no frontend.
- ✅ **Sem segredos commitados.** Só `.env.example` (placeholders) versionado; `.env` no `.gitignore`. `SECRET_KEY` é obrigatório do ambiente (sem default). `DEBUG` default `False`. CORS é **allowlist** (não `ALLOW_ALL`), vindo do ambiente.
- ✅ **Sem SQL raw, sem deserialização perigosa, sem mass assignment.** Nenhum `.raw()`/`cursor.execute` com interpolação; serializers não usam `fields = "__all__"` de forma perigosa; `MeView` PATCH restringe a `nome`/`avatar_url`.
- ✅ **Financeiro com trilha de auditoria.** Editar/excluir lançamento **pago** exige perfil `admin` **e** motivo (5–500 chars) e gera `LogEdicaoLancamento` com snapshot. Valores validados (`> 0`, `DecimalField(max_digits=14)`).
- ✅ **Créditos de IA com reserva atômica.** Cobra antes de chamar a IA (`cache.incr` atômico), com estorno em falha — evita gasto sem contabilização (ressalva de durabilidade em MED-03).
- ✅ **Recuperação de senha resistente a enumeração.** Mensagem silenciosa para email inexistente; token `secrets.token_urlsafe(48)` (alta entropia), **single-use**, com expiração (2h reset / 48h convite).
- ✅ **Hashing de senha padrão do Django** (PBKDF2) + `AUTH_PASSWORD_VALIDATORS`.
- ✅ **Logging estruturado sem vazamento.** O `RequestLoggingMiddleware` registra request_id/método/path/status/duração/user_id/empresa_id/ip — **sem corpo nem headers**, então não vaza token nem senha.
- ✅ **`ModuloAtivo`** bloqueia corretamente views de módulos opcionais desligados (via atributo `modulo` na view).

---

## 4. Checklist pré-publicação

### 🚫 Precisa ser resolvido ANTES de abrir para clientes reais

- [ ] **ALTO-01** — Atualizar dependências (Django, PyJWT, SimpleJWT, Pillow no backend; Next, axios, postcss no frontend). Rodar testes após os bumps.
- [ ] **ALTO-02** — Enforcement de **empresa suspensa no backend** (permission `EmpresaAtiva` bloqueando operações de negócio).
- [ ] **ALTO-03** — **Rate limiting** em `recuperar-senha`, `registro` e `redefinir-senha` (throttle scopes + rede de segurança anônima global).
- [ ] **MED-01** — **Validação de upload** (extensão/MIME/tamanho) nos `FileField` de documentos.
- [ ] **MED-02** — **Headers de segurança** em produção (HSTS, CSP, Referrer-Policy).
- [ ] **MED-05** — Confirmar que **produção não usa o Dockerfile de dev** (runserver/settings.development/root). Se usar, criar imagem de produção.

### ⏳ Pode esperar (recomendado, sem bloquear o lançamento)

- [ ] **MED-03** — Tornar a contabilidade de créditos de IA durável (ou aceitar o risco explicitamente).
- [ ] **MED-04** — Endurecer/documentar o `docker-compose` como somente-dev; senha no Redis, remover/proteger pgAdmin e Flower.
- [ ] **BAIXO-01** — Remover senhas default de credenciais (falhar se ausente).
- [ ] **BAIXO-02** — Adicionar `empresa_id` ao `update()` interno de clientes (defesa em profundidade).
- [ ] **BAIXO-03** — Limpar o import dinâmico no módulo de busca.
- [ ] **BAIXO-04** — Configurar `CSRF_TRUSTED_ORIGINS` se o Django admin for exposto.
- [ ] **BAIXO-05** — Definir limites de upload explícitos no settings.
- [ ] **Contínuo** — Adicionar `pip-audit` e `pnpm audit` ao CI; rodar como não-root nos containers.

---

*Auditoria realizada por leitura de código e varredura automatizada. As ferramentas de dependência (`pip-audit`, `pnpm audit`) refletem os bancos de advisories na data acima. Nenhum código de produção foi modificado nesta branch.*

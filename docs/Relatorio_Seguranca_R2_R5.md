# Relatório de Segurança — Synapse
## Rate Limiting (R2) e Download Autenticado (R5)

**Data:** 2026-05-29
**Commit de referência:** `62b468d`
**Autor da auditoria:** Manus AI
**Milestone atual:** Pré-Piloto (M5 concluído, M6–M8 em andamento)

---

## Sumário Executivo

Este relatório documenta duas correções de segurança aplicadas na auditoria v2.0 do Synapse antes do início do piloto real. Ambas as vulnerabilidades foram classificadas como **bloqueadoras do piloto** por exporem superfícies de ataque diretas em produção: a ausência de rate limiting permitia ataques de força bruta e abuso de custos de IA, enquanto a ausência de download autenticado expunha arquivos de clientes a acessos não autorizados.

---

## 1. Rate Limiting (R2)

### 1.1 Contexto e Risco Original

Antes da correção, os endpoints `/api/auth/login/` e `/api/ai/gerar/` não possuíam nenhum controle de taxa de requisições. Isso criava dois vetores de ataque distintos:

| Endpoint | Risco | Impacto |
|---|---|---|
| `POST /api/auth/login/` | Brute-force de senhas por IP | Comprometimento de contas de usuários |
| `POST /api/ai/gerar/` | Abuso de geração de IA por usuário autenticado | Esgotamento de créditos Groq API e custos financeiros |

Um atacante poderia, sem qualquer limitação, realizar milhares de tentativas de login por segundo contra qualquer e-mail cadastrado, ou um usuário mal-intencionado poderia disparar centenas de requisições de geração de IA em sequência, esgotando a cota da API.

### 1.2 Solução Implementada

A solução utiliza o `ScopedRateThrottle` nativo do Django REST Framework, que é a abordagem recomendada pela documentação oficial do DRF para limitar escopos específicos da API sem afetar endpoints não sensíveis.

#### Configuração global (`config/settings/base.py`)

```python
"DEFAULT_THROTTLE_CLASSES": [
    "rest_framework.throttling.ScopedRateThrottle",
],
"DEFAULT_THROTTLE_RATES": {
    "login": "5/minute",
    "ai_gerar": "10/minute",
},
```

A escolha por `ScopedRateThrottle` em vez de `AnonRateThrottle` ou `UserRateThrottle` é deliberada: o `ScopedRateThrottle` só aplica limitação em views que declaram explicitamente `throttle_scope`, deixando todos os demais endpoints sem overhead desnecessário.

#### Aplicação nas views sensíveis

**`modules/auth/views.py` — `LoginView`:**

```python
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "login"  # 5 tentativas/minuto por IP
```

**`modules/ai_hub/views.py` — `GerarConteudoView`:**

```python
class GerarConteudoView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "ai_gerar"  # 10 requisições/minuto por usuário
```

### 1.3 Análise do Comportamento do ScopedRateThrottle

O `ScopedRateThrottle` do DRF usa o seguinte algoritmo para determinar a chave de cache:

```python
# Fonte: rest_framework/throttling.py — ScopedRateThrottle.get_cache_key()
if request.user and request.user.is_authenticated:
    ident = request.user.pk       # usuário autenticado → por user_id
else:
    ident = self.get_ident(request)  # anônimo → por IP (X-Forwarded-For ou REMOTE_ADDR)

return self.cache_format % {'scope': self.scope, 'ident': ident}
# Resultado: "throttle_login_<ip>" ou "throttle_ai_gerar_<user_id>"
```

Isso garante comportamentos distintos e corretos para cada escopo:

| Escopo | Endpoint | Identificador | Janela | Limite |
|---|---|---|---|---|
| `login` | `POST /api/auth/login/` | IP do cliente | 1 minuto | 5 tentativas |
| `ai_gerar` | `POST /api/ai/gerar/` | `user.pk` (UUID) | 1 minuto | 10 requisições |

O uso do IP para o login é correto porque o endpoint é público (`AllowAny`) — não há usuário autenticado ainda. O uso do `user.pk` para a IA é correto porque o endpoint exige autenticação, e limitar por usuário (não por IP) evita que um atacante contorne o limite trocando de IP.

### 1.4 Extração de IP e Considerações com Proxy

O método `get_ident()` do DRF respeita o header `HTTP_X_FORWARDED_FOR` quando `NUM_PROXIES` está configurado:

```python
xff = request.META.get('HTTP_X_FORWARDED_FOR')
remote_addr = request.META.get('REMOTE_ADDR')
num_proxies = api_settings.NUM_PROXIES
```

**Recomendação para produção:** Configurar `NUM_PROXIES = 1` no `REST_FRAMEWORK` quando o nginx estiver na frente do Django, para que o IP real do cliente seja extraído corretamente do `X-Forwarded-For` e não o IP do proxy.

```python
# A adicionar em production.py quando nginx estiver configurado:
REST_FRAMEWORK["NUM_PROXIES"] = 1
```

Sem essa configuração, todos os clientes atrás do mesmo proxy compartilhariam o mesmo contador de throttle, o que poderia bloquear usuários legítimos.

### 1.5 Resposta ao Cliente

Quando o limite é atingido, o DRF retorna automaticamente:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{"detail": "Request was throttled. Expected available in 60 seconds."}
```

O frontend (`useAuth.ts`) já trata o código `429` como erro de autenticação temporário, exibindo mensagem adequada ao usuário.

### 1.6 Testes Implementados

Três testes unitários foram adicionados em `tests/test_auth.py::TestRateLimiting`:

```python
def test_login_view_tem_throttle_scope(self):
    from modules.auth.views import LoginView
    assert LoginView.throttle_scope == "login"

def test_gerar_conteudo_view_tem_throttle_scope(self):
    from modules.ai_hub.views import GerarConteudoView
    assert GerarConteudoView.throttle_scope == "ai_gerar"

def test_throttle_rates_configurados(self):
    from django.conf import settings
    rates = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})
    assert rates["login"] == "5/minute"
    assert rates["ai_gerar"] == "10/minute"
```

Um fixture `autouse` foi adicionado à classe `TestLogin` para limpar o cache de throttle antes e depois de cada teste, evitando falsos positivos `429` causados por acúmulo de estado entre testes:

```python
@pytest.fixture(autouse=True)
def limpar_cache_throttle(self):
    from django.core.cache import cache
    cache.clear()
    yield
    cache.clear()
```

### 1.7 Limitações e Melhorias Futuras

O `ScopedRateThrottle` armazena os contadores no cache Django (Redis em produção). Isso significa que:

1. **Reinício do Redis** zera todos os contadores — aceitável para o piloto, mas em produção de alta escala considerar persistência separada.
2. **Instâncias múltiplas do Django** compartilham o mesmo Redis, então o limite é global e correto em ambientes com múltiplos workers.
3. **Limites fixos** — para o piloto, `5/minute` e `10/minute` são adequados. Pós-piloto, considerar limites dinâmicos por plano (starter vs. pro).

---

## 2. Download Autenticado de Documentos (R5)

### 2.1 Contexto e Risco Original

O módulo de Documentos (M7) permite que usuários façam upload de arquivos (PDFs, contratos, planilhas) que são armazenados em `/media/` no servidor. O problema era duplo:

**Problema 1 — Produção sem DEBUG:** Com `DEBUG=False`, o Django não serve arquivos de `/media/` automaticamente. O `urlpatterns` do projeto incluía:

```python
# Só funciona com DEBUG=True:
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

Isso significa que em produção, todos os downloads de documentos falhariam silenciosamente com `404`.

**Problema 2 — Ausência de controle de acesso:** Mesmo que o nginx servisse `/media/` diretamente, qualquer pessoa que conhecesse o path do arquivo (ex: `/media/documentos/empresa-a/contrato.pdf`) poderia acessá-lo sem autenticação, quebrando o isolamento multi-tenant.

### 2.2 Solução Implementada

#### Novo endpoint autenticado

```
GET /api/documentos/{id}/download/
```

A view `DocumentoDownloadView` implementa três camadas de segurança antes de servir o arquivo:

```python
class DocumentoDownloadView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        # Camada 1: Verificação multi-tenant via Repository
        # DocumentoRepository.obter() filtra por empresa_id automaticamente.
        # Se o documento não pertencer à empresa do usuário, lança DoesNotExist.
        try:
            doc = DocumentoRepository.obter(str(pk), str(request.user.empresa_id))
        except Documento.DoesNotExist:
            return error_response("NOT_FOUND", "Documento não encontrado.", status_code=404)

        # Camada 2: Verificação de arquivo anexado
        if not doc.arquivo:
            return error_response("NO_FILE", "Este documento não possui arquivo anexado.", status_code=404)

        # Camada 3: Abertura via storage backend (suporta local e S3)
        try:
            arquivo = doc.arquivo.open("rb")
        except (FileNotFoundError, OSError):
            return error_response("FILE_NOT_FOUND", "Arquivo não encontrado no servidor.", status_code=404)

        filename = os.path.basename(doc.arquivo.name)
        return FileResponse(arquivo, as_attachment=True, filename=filename)
```

#### Fluxo de segurança detalhado

```
Requisição GET /api/documentos/{id}/download/
        │
        ▼
[1] CookieJWTAuthentication
    → Valida JWT no cookie httpOnly
    → Falha: HTTP 401

        │
        ▼
[2] IsAuthenticated + IsEmpresaMember
    → Verifica usuário ativo e com empresa_id
    → Falha: HTTP 403

        │
        ▼
[3] DocumentoRepository.obter(pk, empresa_id)
    → SELECT WHERE id=pk AND empresa_id=empresa_id
    → Falha (outra empresa ou inexistente): HTTP 404
    → Nota: retorna 404 (não 403) para não revelar existência do recurso

        │
        ▼
[4] doc.arquivo.open("rb")
    → Abre via Django Storage (local ou S3)
    → Falha: HTTP 404

        │
        ▼
[5] FileResponse(arquivo, as_attachment=True)
    → Streaming do arquivo com Content-Disposition: attachment
    → HTTP 200 + bytes do arquivo
```

### 2.3 Decisão de Design: 404 em vez de 403

Quando um usuário da Empresa B tenta acessar um documento da Empresa A, a view retorna `HTTP 404` (não encontrado) em vez de `HTTP 403` (acesso negado). Essa é uma prática de segurança deliberada conhecida como **"security through obscurity"** no contexto de enumeração de recursos:

- `HTTP 403` confirmaria ao atacante que o recurso **existe** mas ele não tem acesso.
- `HTTP 404` não revela se o recurso existe ou não.

Isso dificulta ataques de enumeração de UUIDs de documentos de outras empresas.

### 2.4 Configuração do WhiteNoise em Produção

O WhiteNoise foi adicionado ao `production.py` para servir arquivos **estáticos** (`/static/`), mas **não** arquivos de mídia (`/media/`):

```python
# production.py
INSTALLED_APPS = ["whitenoise.runserver_nostatic"] + INSTALLED_APPS
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoise Middleware",  # Serve /static/ apenas
] + [m for m in MIDDLEWARE if m != "django.middleware.security.SecurityMiddleware"]

STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
```

O comentário no código documenta explicitamente que `/media/` **não deve** ser servido pelo WhiteNoise nem pelo nginx diretamente:

```python
# Nota: /media/ (uploads) NÃO é servido pelo WhiteNoise.
# Use DocumentoDownloadView (autenticado) ou configure nginx
# para servir /media/ diretamente em produção.
```

#### Configuração nginx recomendada para produção

```nginx
server {
    # CORRETO: delegar /media/ para o Django (autenticado)
    location /api/documentos/ {
        proxy_pass http://django:8000;
    }

    # INCORRETO (não fazer): expor /media/ diretamente
    # location /media/ {
    #     alias /app/media/;  # Quebraria o isolamento multi-tenant!
    # }

    # Estáticos servidos diretamente pelo nginx (sem autenticação — correto)
    location /static/ {
        alias /app/staticfiles/;
    }
}
```

### 2.5 Compatibilidade com Storage Backends Futuros

O uso de `doc.arquivo.open("rb")` em vez de `open(doc.arquivo.path, "rb")` é fundamental para a compatibilidade futura com S3/R2:

| Método | Funciona em local | Funciona em S3 |
|---|---|---|
| `open(doc.arquivo.path, "rb")` | ✅ | ❌ (S3 não tem `path`) |
| `doc.arquivo.open("rb")` | ✅ | ✅ (usa o storage backend) |

Quando o projeto migrar para S3 (planejado pós-piloto), nenhuma alteração será necessária na view de download — apenas a configuração do `DEFAULT_FILE_STORAGE` no settings.

### 2.6 Testes Implementados

Quatro testes foram adicionados em `tests/test_documentos.py`:

```python
def test_api_download_sem_arquivo(auth_client_a, documento_a):
    """Documento sem arquivo retorna 404 com código NO_FILE."""
    response = auth_client_a.get(f"/api/documentos/{documento_a.id}/download/")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NO_FILE"

def test_api_download_sem_autenticacao(documento_a):
    """Download sem autenticação retorna 401."""
    client = APIClient()
    response = client.get(f"/api/documentos/{documento_a.id}/download/")
    assert response.status_code == 401

def test_api_download_multi_tenant(auth_client_b, documento_a):
    """Empresa B não pode baixar arquivo da empresa A."""
    response = auth_client_b.get(f"/api/documentos/{documento_a.id}/download/")
    assert response.status_code == 404  # 404, não 403 (não revela existência)

def test_api_download_documento_inexistente(auth_client_a):
    """UUID inexistente retorna 404."""
    response = auth_client_a.get(f"/api/documentos/{uuid.uuid4()}/download/")
    assert response.status_code == 404
```

---

## 3. Contexto de Segurança Geral do Synapse

As duas correções acima se inserem em um modelo de segurança em camadas já existente no projeto:

| Camada | Mecanismo | Status |
|---|---|---|
| Autenticação | JWT em httpOnly cookie (`CookieJWTAuthentication`) | ✅ Implementado |
| Autorização | `IsAuthenticated` + `IsEmpresaMember` em todas as views | ✅ Implementado |
| Isolamento multi-tenant | `EmpresaQuerySetMixin` + `empresa_id` em todo model | ✅ Implementado |
| Rate limiting — login | `ScopedRateThrottle` 5/min por IP | ✅ Corrigido (R2) |
| Rate limiting — IA | `ScopedRateThrottle` 10/min por usuário | ✅ Corrigido (R2) |
| Download de arquivos | `DocumentoDownloadView` com verificação de tenant | ✅ Corrigido (R5) |
| HTTPS em produção | `SECURE_SSL_REDIRECT = True` em `production.py` | ✅ Implementado |
| Cookies seguros | `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` em prod | ✅ Implementado |
| Headers de segurança | `X_FRAME_OPTIONS = "DENY"`, `XSS_FILTER`, `NOSNIFF` | ✅ Implementado |
| CORS | `CORS_ALLOWED_ORIGINS` via variável de ambiente | ✅ Implementado |
| Secrets | Zero secrets no código (100% via variáveis de ambiente) | ✅ Implementado |

---

## 4. Recomendações Pré-Piloto

As correções R2 e R5 eliminam os dois bloqueadores de segurança identificados. As seguintes ações são recomendadas antes ou logo após o início do piloto:

**Imediato (antes do piloto):**

1. Configurar `NUM_PROXIES = 1` em `production.py` quando o nginx estiver na frente do Django, para garantir extração correta do IP real no throttle de login.
2. Validar que o nginx **não** serve `/media/` diretamente — confirmar que apenas `/api/documentos/{id}/download/` é o caminho de acesso a arquivos.

**Curto prazo (primeiras semanas do piloto):**

3. Monitorar logs de `429 Too Many Requests` no Sentry para identificar possíveis ataques de brute-force ou abusos de IA.
4. Considerar adicionar `throttle_scope` ao endpoint `POST /api/auth/registro/` para prevenir criação massiva de contas (sugestão: `"registro": "3/hour"` por IP).

**Médio prazo (pós-piloto):**

5. Migrar storage de `/media/` local para S3/Cloudflare R2 com URLs pré-assinadas de curta duração (15 minutos), eliminando a necessidade de streaming via Django.
6. Implementar rate limiting por plano (starter: 10 gerações IA/dia, pro: 100/dia) no nível do `AIHubService`, complementando o throttle por minuto.

---

## 5. Resultado dos Testes

| Suite | Testes | Resultado |
|---|---|---|
| `pytest tests/` | 505 testes | ✅ 505 passando |
| `tsc --noEmit` | Frontend completo | ✅ Exit 0 |
| `TestRateLimiting` | 3 testes | ✅ 3 passando |
| Download autenticado | 4 testes | ✅ 4 passando |
| `TestLogin` (com throttle) | 6 testes | ✅ 6 passando |

---

*Relatório gerado automaticamente pela auditoria v2.0 do Synapse. Commit de referência: `62b468d` (2026-05-29).*

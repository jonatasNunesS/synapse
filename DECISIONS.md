# Synapse - Decisões Técnicas

## M0 - Fundação

### Decisão 1: Estrutura do Repositório
**O quê:** Monorepo único com `backend/` e `frontend/` na raiz.
**Por quê:** Simplicidade para time solo. Um único `docker-compose.yml` sobe tudo.
**Alternativas consideradas:** Repos separados (descartado por complexidade desnecessária).

### Decisão 2: Multi-Tenant
**O quê:** Isolamento lógico padrão do Django com `EmpresaQuerySetMixin`.
**Por quê:** Mais simples, sem dependência de pacotes externos como `django-tenants`.
**Alternativas consideradas:** `django-tenants` com schemas separados (descartado por complexidade).

### Decisão 3: Storage de Arquivos
**O quê:** Pasta `/media/` local via `MEDIA_ROOT` do Django.
**Por quê:** Sem custos de cloud storage no MVP. Simplicidade máxima.
**Alternativas consideradas:** Cloudflare R2, AWS S3 (adiados para pós-piloto).

### Decisão 4: Provedor de Email
**O quê:** Resend (API simples, 3k emails/mês grátis).
**Por quê:** API moderna e simples. Tier gratuito suficiente para piloto.
**Alternativas consideradas:** SendGrid, AWS SES (mais complexos para o momento).

### Decisão 5: IA no M0
**O quê:** Apenas placeholder `GROQ_API_KEY=` no `.env.example`. Interface `i_ia.py` criada sem implementação.
**Por quê:** IA só entra no M9. Não bloqueia o MVP.

### Decisão 6: Pagamentos
**O quê:** Controle manual via Django Admin. Campo `plano` no model Empresa.
**Por quê:** Gateway de pagamento fora do escopo do MVP.

### Decisão 7: Estratégia de Desenvolvimento
**O quê:** Intercalado por funcionalidade (Model → Repo → Service → View → Teste → Frontend).
**Por quê:** Permite validação ponta a ponta de cada feature antes de avançar.

### Decisão 8: Identidade Visual
**O quê:** Dark mode padrão. Paleta azul-escuro + roxo (#1E1B4B e #6D28D9). Inter font.
**Por quê:** Referências: Linear, Vercel Dashboard, Notion. SaaS B2B moderno.

### Decisão 9: Redis
**O quê:** Redis via Docker Compose local na porta 6379.
**Por quê:** Sem custos externos. Variável `REDIS_URL` facilmente substituível em produção.

### Decisão 10: Checkpoints
**O quê:** Fundador testa localmente via `docker-compose up` seguindo roteiro.
**Por quê:** Sem staging externo. Validação direta e prática.

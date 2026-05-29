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

---

## Auditoria v2.0 — Desvios Corrigidos (2026-05-29)

### Decisão 11: Next.js 16 em vez de 14

**O quê:** O `package.json` do frontend usa Next.js 16 (instalado via `pnpm`), enquanto a documentação de stack menciona Next.js 14.

**Por quê:** O `pnpm` resolveu a versão mais recente disponível no momento da instalação. Next.js 16 é retrocompatível com a API do App Router usada no projeto. Nenhuma feature exclusiva do 14 foi utilizada.

**Impacto:** Nenhum. Todos os testes de tipagem (`tsc --noEmit`) passam sem erros.

**Ação:** Stack documentada atualizada para "Next.js 16+". Não há necessidade de downgrade.

---

### Decisão 12: KanbanBoard reescrito de HTML5 nativo para @dnd-kit

**O quê:** O `KanbanBoard.tsx` do módulo de Projetos foi inicialmente implementado com a HTML5 Drag and Drop API nativa (`draggable`, `onDragStart`, `onDrop`).

**Por quê:** A implementação inicial priorizou velocidade de entrega. A HTML5 DnD API não suporta eventos de touch em dispositivos móveis, tornando o Kanban inutilizável em smartphones.

**Correção (Auditoria v2.0):** Reescrito usando `@dnd-kit/core` com `PointerSensor` (mesmo padrão do `FunilKanban.tsx` do módulo CRM), que suporta mouse e touch nativamente. `activationConstraint: { distance: 8 }` evita disparar drag em cliques simples.

**Referência:** `frontend/components/projetos/KanbanBoard.tsx` — commit da auditoria v2.0.

---

### Decisão 13: Download de arquivos via view autenticada (não URL pública)

**O quê:** Arquivos de documentos (`/media/`) são servidos via `GET /api/documentos/{id}/download/` usando `FileResponse`, em vez de URLs públicas do Django.

**Por quê:** Em produção com `DEBUG=False`, o Django não serve `/media/` automaticamente. Expor URLs públicas de `/media/` quebraria o isolamento multi-tenant (qualquer usuário poderia acessar arquivos de outra empresa conhecendo o path).

**Implementação:** `DocumentoDownloadView` verifica `empresa_id` antes de servir o arquivo. Em produção, o nginx deve ser configurado para **não** servir `/media/` diretamente, delegando para a view Django.

**Alternativa futura:** Migrar para S3/R2 com URLs pré-assinadas (planejado pós-piloto).

# M5 — Fornecedores: Checklist de Validação

**Status:** ✅ Concluído  
**Data:** 2025-05-16  
**Testes totais:** 242 (44 novos no M5)

---

## Backend

### Models
- [x] `CategoriaFornecedor` — nome, cor, ativo, empresa_id (multi-tenant)
- [x] `Fornecedor` — 20+ campos, status enum, score_synapse (DecimalField calculado), empresa_id
- [x] `CompraFornecedor` — valor, data, NF, status (pendente/pago/cancelado), FK para Fornecedor
- [x] Signal `post_save` em `CompraFornecedor` → recalcula `score_synapse` do fornecedor
- [x] Migrations aplicadas

### Serializers
- [x] `CategoriaFornecedorSerializer` — CRUD completo
- [x] `FornecedorListSerializer` — campos resumidos + score + link_whatsapp + ticket_medio
- [x] `FornecedorDetailSerializer` — todos os campos + compras nested (últimas 5)
- [x] `FornecedorCreateUpdateSerializer` — sem campo `ativo` (bug DRF corrigido)
- [x] `AvaliacaoFornecedorSerializer` — qualidade/prazo/preço (1–5)
- [x] `CompraFornecedorSerializer` — com criado_por_nome
- [x] `RankingFornecedorSerializer` — com posicao calculada
- [x] `ResumoFornecedoresSerializer` — KPIs agregados

### Repository
- [x] `listar_fornecedores()` — filtros: search, status, categoria; paginação
- [x] `obter_fornecedor()` — com prefetch de compras
- [x] `obter_resumo()` — aggregations: total, ativos, gasto, ticket_medio, melhor_score
- [x] `obter_ranking()` — ordenado por score_synapse, avaliacao__isnull=False (compat SQLite)
- [x] `listar_compras()` — por fornecedor, paginado
- [x] Multi-tenant validado em todas as queries (empresa_id)

### Service
- [x] `criar_fornecedor()` — com cache invalidation
- [x] `atualizar_fornecedor()` — PATCH parcial + cache invalidation
- [x] `soft_delete_fornecedor()` — seta ativo=False, não deleta fisicamente
- [x] `avaliar_fornecedor()` — salva avaliações + recalcula score_synapse
- [x] `criar_compra()` — registra compra + dispara signal de recálculo
- [x] Cache Redis: TTL 24h, chave `synapse:{empresa_id}:fornecedores:{tipo}`
- [x] Invalidação automática em toda escrita

### Tasks Celery
- [x] `recalcular_score_fornecedor` — task assíncrona para recálculo de score
- [x] `sincronizar_dados_fornecedor` — task para sincronização de dados externos

### Views & URLs
- [x] `GET /api/fornecedores/resumo/` — KPIs do módulo
- [x] `GET /api/fornecedores/ranking/` — ranking por Score Synapse
- [x] `GET/POST /api/fornecedores/categorias/` — listagem e criação
- [x] `GET/PUT/PATCH/DELETE /api/fornecedores/categorias/{id}/` — CRUD
- [x] `GET/POST /api/fornecedores/` — listagem (paginada) e criação
- [x] `GET/PUT/PATCH/DELETE /api/fornecedores/{id}/` — detalhe e edição
- [x] `POST /api/fornecedores/{id}/avaliar/` — avaliação de fornecedor
- [x] `GET/POST /api/fornecedores/{id}/compras/` — histórico e registro de compras

### Admin Django
- [x] `CategoriaFornecedorAdmin` — list_display, search, filter
- [x] `FornecedorAdmin` — list_display com score_synapse, inline de compras
- [x] `CompraFornecedorAdmin` — list_display, filter por status

### Testes (44 novos, 242 total)
- [x] Happy path: criar, listar, detalhar, editar, deletar fornecedor
- [x] Dados inválidos: nome vazio, avaliação fora do range (1–5), valor negativo
- [x] Acesso negado: outro tenant não acessa dados alheios (403/404)
- [x] Cache: hit/miss validado, invalidação após escrita
- [x] Multi-tenant: empresa_id isolado em todas as operações
- [x] Score Synapse: cálculo correto com signal pós-save de compra
- [x] Ranking: ordenação correta, apenas fornecedores avaliados

---

## Frontend

### Types
- [x] `types/fornecedores.ts` — interfaces: CategoriaFornecedor, FornecedorList, FornecedorDetail, CompraFornecedor, RankingFornecedor, ResumoFornecedores, form types

### Hooks
- [x] `hooks/useFornecedores.ts` — hooks: useResumoFornecedores, useRankingFornecedores, useCategoriasFornecedor, useFornecedores, useFornecedorDetail, useComprasFornecedor

### Componentes
- [x] `components/fornecedores/ResumoCards.tsx` — 4 KPI cards (total, ativos, gasto, ticket médio)
- [x] `components/fornecedores/ScoreSynapse.tsx` — badge inline + card com arco SVG (0–100, cor progressiva)
- [x] `components/fornecedores/AvaliacaoStars.tsx` — estrelas interativas + AvaliacaoTripla (qualidade/prazo/preço)
- [x] `components/fornecedores/FornecedorTable.tsx` — tabela com busca, filtros, paginação, score visual, badge de status
- [x] `components/fornecedores/FornecedorForm.tsx` — modal com React Hook Form + Zod, 15+ campos
- [x] `components/fornecedores/AvaliacaoModal.tsx` — modal de avaliação com preview de média
- [x] `components/fornecedores/HistoricoCompras.tsx` — lista paginada + formulário de nova compra
- [x] `components/fornecedores/RankingFornecedores.tsx` — ranking com troféus, posição, score e avaliações

### Páginas
- [x] `app/(dashboard)/fornecedores/page.tsx` — dashboard: KPIs + tabela (2/3) + ranking (1/3)
- [x] `app/(dashboard)/fornecedores/[id]/page.tsx` — detalhe: info + ScoreSynapseCard + avaliações + histórico de compras

### Navegação
- [x] Sidebar: Fornecedores habilitado (removido `disabled: true`)

---

## Critérios de Aceite

| Critério | Status |
|---|---|
| Happy path (CRUD completo) | ✅ |
| Dados inválidos retornam erro 400 | ✅ |
| Acesso negado retorna 403/404 | ✅ |
| Cache Redis implementado (TTL 24h) | ✅ |
| Multi-tenant validado | ✅ |
| Responsivo (375px e 1280px) | ✅ |
| Build frontend limpo | ✅ |
| 242 testes passando | ✅ |

---

## Score Synapse — Fórmula

O Score Synapse é calculado automaticamente com base em 3 componentes:

```
score_synapse = (
  avaliacao_media * 0.4 +   # 40% — média de qualidade/prazo/preço (1–5 → 0–100)
  pontualidade   * 0.3 +   # 30% — % de compras pagas no prazo
  volume         * 0.3     # 30% — normalização do volume de compras
)
```

- Faixa: 0–100
- Cor: Crítico (0–19) → Fraco (20–39) → Regular (40–59) → Bom (60–79) → Excelente (80–100)
- Recalculado automaticamente via signal `post_save` em `CompraFornecedor`

---

## Próximo Milestone

**M6 — Projetos/Tarefas** (aguardando aprovação do fundador)

Escopo previsto:
- Models: Projeto, Tarefa, Comentário, Anexo
- Kanban com drag-and-drop (@dnd-kit)
- Sprints e milestones
- Integração com Equipe (M7)

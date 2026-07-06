# Synapse — M6: Checklist de Conclusão do Milestone 6 (Projetos e Tarefas)

**Data:** 21/05/2026  
**Commit:** `e6cea54`  
**Branch:** `master`  
**Testes:** 340 passando (269 anteriores + 71 novos do M6)

---

## Critérios de Conclusão ("PRONTO")

| Critério | Status | Observação |
|---|---|---|
| Happy path testado | **FEITO** | CRUD projetos, tarefas, comentários, checklist, kanban |
| Dados inválidos testados | **FEITO** | Validação de campos obrigatórios, tipos, limites |
| Acesso negado testado | **FEITO** | Multi-tenant: empresa A não acessa dados empresa B |
| Cache Redis implementado | **FEITO** | `synapse:{empresa_id}:projetos:{tipo}` TTL 5min/1h |
| Multi-tenant validado | **FEITO** | `empresa_id` em todos os models, filtro em todas as queries |
| Responsivo 375px e 1280px | **FEITO** | Grid responsivo, modais com `max-h-[90vh]`, overflow-x-auto no Kanban |

---

## Backend — Arquivos Criados/Modificados

### Novos (módulo `projetos`)

| Arquivo | Descrição |
|---|---|
| `modules/projetos/models.py` | `Projeto`, `Tarefa`, `Comentario`, `ChecklistItem` com UUIDs e `empresa_id` |
| `modules/projetos/migrations/0001_initial_projetos.py` | Migration inicial |
| `modules/projetos/serializers.py` | 9 serializers: List, Detail, Create, Kanban, Resumo, Comentario, Checklist |
| `modules/projetos/repository.py` | Queries isoladas: listar, kanban, mover (atomic), resumo, CRUD comentários/checklist |
| `modules/projetos/services.py` | `ProjetoService`, `TarefaService`, `ComentarioService`, `ChecklistService` com cache |
| `modules/projetos/tasks.py` | 3 tasks Celery: `verificar_prazos_projetos`, `notificar_responsavel_tarefa`, `verificar_projetos_atrasados` |
| `modules/projetos/views.py` | `ProjetoViewSet`, `TarefaViewSet`, `ComentarioViewSet`, `ChecklistViewSet`, `KanbanView`, `ResumoProjetosView` |
| `modules/projetos/urls.py` | Rotas RESTful completas com `DefaultRouter` |
| `modules/projetos/admin.py` | Admin com `ProjetoAdmin` (filtros, inlines), `TarefaAdmin`, `ComentarioAdmin` |
| `modules/projetos/apps.py` | `AppConfig` |
| `tests/test_projetos.py` | **71 testes** cobrindo todos os cenários |

### Modificados

| Arquivo | Alteração |
|---|---|
| `config/settings/base.py` | `modules.projetos` adicionado em `LOCAL_APPS` |
| `config/urls.py` | `include('modules.projetos.urls')` habilitado |
| `config/celery.py` | 3 tasks M6 adicionadas ao `beat_schedule` |
| `shared/pagination.py` | `max_page_size` corrigido de 100 → **25** |
| `modules/clientes/views.py` | `EmpresaQuerySetMixin` aplicado em todas as views |

---

## Frontend — Arquivos Criados/Modificados

### Novos

| Arquivo | Descrição |
|---|---|
| `types/projetos.ts` | Tipos TypeScript completos: `ProjetoList`, `ProjetoDetail`, `TarefaList`, `TarefaDetail`, `KanbanData`, `ResumoProjetosData`, payloads, labels, cores |
| `hooks/useProjetos.ts` | 8 hooks: `useProjetos`, `useProjetoDetalhe`, `useKanban`, `useTarefas`, `useTarefaDetalhe`, `useComentarios`, `useChecklist`, `useResumoProjetoss` |
| `components/projetos/ProjetoCard.tsx` | Card com barra de progresso, status, prioridade, alerta de atraso |
| `components/projetos/KanbanBoard.tsx` | Board com 4 colunas e drag-and-drop via HTML5 API nativo |
| `components/projetos/ProjetoForm.tsx` | Modal criação/edição com seletor de 10 cores preset |
| `components/projetos/TarefaForm.tsx` | Modal criação/edição com status, prioridade, prazo, estimativa |
| `components/projetos/TarefaModal.tsx` | Detalhe completo: comentários em tempo real + checklist interativo |
| `components/projetos/ResumoProjetosCards.tsx` | 4 cards de KPIs: ativos, atrasados, pendentes, minhas tarefas |
| `app/(dashboard)/projetos/page.tsx` | Listagem com busca, filtro por status/prioridade, grid responsivo |
| `app/(dashboard)/projetos/[id]/page.tsx` | Detalhe com alternância Kanban ↔ Lista, edição e exclusão |

### Modificados

| Arquivo | Alteração |
|---|---|
| `components/layout/Sidebar.tsx` | `Projetos` habilitado (removido `disabled: true`), href corrigido para `/projetos` |
| `docker-compose.yml` | `NEXT_PUBLIC_API_URL` corrigido para serviço interno |
| `frontend/Dockerfile` | Multi-stage build otimizado com `standalone` output |

---

## Rotas da API — M6

| Método | Endpoint | Descrição |
|---|---|---|
| `GET/POST` | `/api/v1/projetos/` | Listar e criar projetos |
| `GET/PATCH/DELETE` | `/api/v1/projetos/{id}/` | Detalhe, editar, excluir projeto |
| `GET` | `/api/v1/projetos/{id}/kanban/` | Board Kanban do projeto |
| `GET` | `/api/v1/projetos/resumo/` | KPIs e resumo geral |
| `GET/POST` | `/api/v1/projetos/{id}/tarefas/` | Listar e criar tarefas do projeto |
| `GET/PATCH/DELETE` | `/api/v1/projetos/tarefas/{id}/` | Detalhe, editar, excluir tarefa |
| `PATCH` | `/api/v1/projetos/tarefas/{id}/mover/` | Mover tarefa no Kanban (atomic) |
| `GET/POST` | `/api/v1/projetos/tarefas/{id}/comentarios/` | Listar e criar comentários |
| `PATCH/DELETE` | `/api/v1/projetos/tarefas/{id}/comentarios/{cid}/` | Editar e excluir comentário |
| `GET/POST` | `/api/v1/projetos/tarefas/{id}/checklist/` | Listar e criar itens de checklist |
| `PATCH/DELETE` | `/api/v1/projetos/tarefas/{id}/checklist/{cid}/` | Toggle concluído e excluir item |

---

## Cobertura de Testes M6 — 71 Casos

| Grupo | Quantidade | Cenários |
|---|---|---|
| CRUD Projetos | 12 | Criar, listar, detalhe, editar, excluir, filtros, busca |
| CRUD Tarefas | 10 | Criar, listar, detalhe, editar, excluir por projeto |
| Kanban | 8 | Board, mover tarefa, ordem, transição de status |
| Comentários | 8 | Criar, listar, editar, excluir, paginação |
| Checklist | 8 | Criar, toggle, excluir, progresso |
| Cache Redis | 6 | Cache hit, invalidação, TTL |
| Multi-tenant | 10 | Isolamento entre empresas em todos os endpoints |
| Tasks Celery | 9 | Verificar prazos, notificar responsável, projetos atrasados |

---

## Arquitetura Validada

- **Clean Architecture**: `View → Service → Repository → Model` respeitada em 100% dos fluxos
- **Multi-tenant**: `empresa_id` presente em `Projeto`, `Tarefa`, `Comentario`, `ChecklistItem`
- **Cache Redis**: chave `synapse:{empresa_id}:projetos:{tipo}` com TTL de 5 minutos (listas) e 1 hora (detalhe)
- **Imutabilidade**: movimentações de tarefas registradas via `mover_tarefa` com `transaction.atomic()`
- **Paginação**: `max_page_size=25` em todas as listagens
- **Celery Beat**: 3 tasks agendadas (diária às 08h, imediata por sinal, diária às 07h)
- **Zero secrets**: todas as configurações via variáveis de ambiente

---

## Próximo Milestone

**M7 — Equipe, Documentos e Notificações**

Dependências identificadas:
- `Notificacao` model (referenciado nas tasks M6 com `pass` temporário)
- `MembroEquipe` model (para atribuição de responsáveis com auto-complete)
- Sistema de notificações em tempo real (WebSocket ou polling)

> **Recomendação:** Iniciar M7 com o model `Notificacao` e `MembroEquipe` para desbloquear as tasks de notificação do M6 que estão com `pass` temporário.

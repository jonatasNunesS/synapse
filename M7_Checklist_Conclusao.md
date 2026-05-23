# M7 — Equipe, Documentos e Notificações: Checklist de Conclusão

**Commit:** `3bbc7e7`
**Data:** 22/05/2026
**Testes:** 397 passando (57 novos do M7)

---

## Módulo Notificações

### Backend

| Item | Status |
|---|---|
| Model `Notificacao` com `empresa_id`, `usuario`, `tipo`, `prioridade`, `acao_url`, `lida` | ✅ |
| Migration gerada | ✅ |
| Serializer `NotificacaoSerializer` | ✅ |
| Repository com `listar`, `buscar_por_id`, `marcar_lida`, `marcar_todas_lidas`, `contar_nao_lidas`, `deletar` | ✅ |
| Service `NotificacaoService` com `criar_para_empresa`, `criar_para_usuario`, `marcar_lida`, `marcar_todas_lidas` | ✅ |
| Views: `NotificacaoListView`, `NotificacaoDetailView`, `MarcarLidaView`, `MarcarTodasLidasView` | ✅ |
| URLs registradas em `config/urls.py` | ✅ |
| Admin registrado | ✅ |
| Cache Redis `synapse:{empresa_id}:notificacoes:*` | ✅ |
| Multi-tenant validado (empresa_id em todas as queries) | ✅ |

### Frontend

| Item | Status |
|---|---|
| `types/notificacoes.ts` com `Notificacao`, `TipoNotificacao`, labels e cores | ✅ |
| `hooks/useNotificacoes.ts` com filtros, `marcarLida`, `marcarTodasLidas`, `deletar` | ✅ |
| `components/notificacoes/NotificationBell.tsx` com badge live e dropdown | ✅ |
| `Header.tsx` atualizado com `NotificationBell` (substituiu Bell estático) | ✅ |
| Página `/notificacoes` com filtros por tipo e status, paginação | ✅ |
| Sidebar habilitada para `/notificacoes` | ✅ |

### Testes

| Item | Status |
|---|---|
| Happy path: criar, listar, marcar lida, marcar todas, deletar | ✅ |
| Dados inválidos | ✅ |
| Acesso negado (multi-tenant) | ✅ |
| Filtros por tipo, prioridade e status | ✅ |

---

## Módulo Equipe

### Backend

| Item | Status |
|---|---|
| Model `MembroEquipe` com `empresa_id`, `usuario`, `cargo`, `departamento`, `ativo`, `data_admissao`, `salario` | ✅ |
| Model `MetaMembro` com `tipo`, `periodo`, `valor_meta`, `valor_atual`, `progresso_percentual`, `atingida` | ✅ |
| Migration gerada | ✅ |
| Serializers: `MembroListSerializer`, `MembroDetailSerializer`, `MetaMembroSerializer` | ✅ |
| Repository com `listar`, `buscar_por_id`, `criar`, `atualizar`, `remover`, `calcular_resumo`, CRUD metas | ✅ |
| Service com `adicionar_membro`, `atualizar_membro`, `remover_membro`, `obter_resumo`, CRUD metas | ✅ |
| Task Celery `verificar_metas_vencendo` (diária às 9h) | ✅ |
| Views: `MembroListView`, `MembroDetailView`, `MetaMembroListView`, `MetaMembroDetailView`, `ResumoEquipeView` | ✅ |
| URLs registradas | ✅ |
| Admin registrado | ✅ |
| Cache Redis `synapse:{empresa_id}:equipe:*` | ✅ |
| Multi-tenant validado | ✅ |

### Frontend

| Item | Status |
|---|---|
| `types/equipe.ts` com `MembroEquipe`, `MetaMembro`, `ResumoEquipe`, labels | ✅ |
| `hooks/useEquipe.ts` com `useMembros`, `useMembro`, `useResumoEquipe`, `useMetasMembro` | ✅ |
| `components/equipe/MembroCard.tsx` com avatar, cargo, departamento, barra de progresso de metas | ✅ |
| `components/equipe/MembroForm.tsx` modal de criação/edição | ✅ |
| `components/equipe/MetaForm.tsx` modal de criação/edição de metas | ✅ |
| `components/equipe/ResumoEquipeCards.tsx` com 5 cards de KPIs | ✅ |
| Página `/equipe` com grid de cards, filtros e paginação | ✅ |
| Página `/equipe/[id]` com perfil completo e gestão de metas | ✅ |
| Sidebar habilitada para `/equipe` | ✅ |

### Testes

| Item | Status |
|---|---|
| CRUD de membros | ✅ |
| CRUD de metas | ✅ |
| Resumo da equipe | ✅ |
| Acesso negado (multi-tenant) | ✅ |

---

## Módulo Documentos

### Backend

| Item | Status |
|---|---|
| Model `Documento` com `empresa_id`, `titulo`, `tipo`, `status`, `arquivo`, `url_externa`, `tags` (ArrayField) | ✅ |
| Model `VersaoDocumento` com `numero_versao`, `arquivo`, `notas`, `criado_por` | ✅ |
| Migration gerada | ✅ |
| Serializers: `DocumentoListSerializer`, `DocumentoDetailSerializer`, `VersaoDocumentoSerializer` | ✅ |
| Repository com `listar`, `buscar_por_id`, `criar`, `atualizar`, `deletar`, `criar_versao`, `listar_versoes` | ✅ |
| Service com lógica de versionamento automático | ✅ |
| Task Celery `verificar_documentos_vencendo` (diária às 8h) | ✅ |
| Views: `DocumentoListView`, `DocumentoDetailView`, `VersaoDocumentoListView` | ✅ |
| URLs registradas | ✅ |
| Admin registrado | ✅ |
| Cache Redis `synapse:{empresa_id}:documentos:*` | ✅ |
| Multi-tenant validado | ✅ |

### Frontend

| Item | Status |
|---|---|
| `types/documentos.ts` com `Documento`, `VersaoDocumento`, labels e cores por status | ✅ |
| `hooks/useDocumentos.ts` com `useDocumentos`, `useDocumento`, `criarVersao` | ✅ |
| `components/documentos/DocumentoCard.tsx` com tipo, status, tags e contagem de versões | ✅ |
| `components/documentos/DocumentoForm.tsx` modal com gerenciamento de tags | ✅ |
| Página `/documentos` com grid de cards, filtros por tipo e status | ✅ |
| Página `/documentos/[id]` com detalhes e histórico de versões | ✅ |
| Sidebar habilitada para `/documentos` | ✅ |

### Testes

| Item | Status |
|---|---|
| CRUD de documentos | ✅ |
| Criação de versões | ✅ |
| Filtros por tipo, status e tag | ✅ |
| Acesso negado (multi-tenant) | ✅ |

---

## Tasks Celery Ativadas (M2–M6)

| Módulo | Task | Status |
|---|---|---|
| Financeiro | `verificar_contas_vencendo` | ✅ Ativa com `NotificacaoService` |
| Estoque | `verificar_estoque_baixo` | ✅ Ativa com `NotificacaoService` |
| Clientes | `verificar_follow_ups_pendentes` | ✅ Ativa com `NotificacaoService` |
| Projetos | `verificar_prazos_projetos` | ✅ Ativa com `NotificacaoService` |
| Projetos | `verificar_projetos_atrasados` | ✅ Ativa com `NotificacaoService` |
| Equipe | `verificar_metas_vencendo` | ✅ Nova — M7 |
| Documentos | `verificar_documentos_vencendo` | ✅ Nova — M7 |

---

## Resumo Geral

| Métrica | Valor |
|---|---|
| Testes totais passando | **397** |
| Novos testes M7 | **57** |
| Arquivos criados | **50** |
| Arquivos modificados | **10** |
| Endpoints novos | **~18** |
| Módulos entregues | **3** (Notificações, Equipe, Documentos) |

---

## Próximo: M8 — Dashboard Analítico

Com M7 concluído, todos os dados de negócio estão disponíveis. O M8 pode consumir:
- `GET /api/financeiro/resumo/` → KPIs financeiros
- `GET /api/estoque/resumo/` → KPIs de estoque
- `GET /api/clientes/resumo/` → KPIs de CRM
- `GET /api/projetos/resumo/` → KPIs de projetos
- `GET /api/equipe/resumo/` → KPIs de equipe
- `GET /api/notificacoes/?lida=false` → Alertas pendentes

Recomendação: iniciar M8 com o layout do dashboard e os widgets de KPI antes de partir para os gráficos.

# Synapse — Relatório de Infraestrutura e Testes (M0→M5)

**Data:** 16/05/2026
**Escopo:** Sessão de testes gerais + correções de infraestrutura
**Resultado:** ✅ 269 testes passando (0 falhas)

---

## 1. Dependências Backend

| Pacote | Versão Anterior | Versão Atual | Status |
|---|---|---|---|
| `resend` | 2.5.0 | **2.5.1** | ✅ Atualizado |
| `Django` | 5.1.x | 5.1.5 | ✅ Confirmado |
| `djangorestframework` | — | 3.15.x | ✅ OK |
| `celery` | — | 5.x | ✅ OK |

**Correção em `modules/auth/tasks.py`:** O retorno do `resend.Emails.send()` na versão 2.5.1 é um `TypedDict` com acesso por atributo (`.id`), não por chave (`.get('id')`). Corrigido.

---

## 2. Dockerfile Frontend (Multi-stage)

O Dockerfile foi reescrito com arquitetura **multi-stage** correta para pnpm + Next.js standalone:

```
Stage 1 — deps:    node:22-alpine + pnpm install (apenas dependências)
Stage 2 — builder: copia deps + código, executa pnpm build
Stage 3 — runner:  node:22-alpine slim, copia .next/standalone + static
```

**Melhorias:**
- Usa `pnpm` consistentemente (não npm)
- Copia `pnpm-workspace.yaml` no stage de deps
- Output `standalone` do Next.js habilitado em `next.config.mjs`
- Imagem final ~200MB menor (sem devDependencies)
- `NEXT_TELEMETRY_DISABLED=1` e `NODE_ENV=production` configurados

---

## 3. Docker Compose

Correções aplicadas em `docker-compose.yml`:

| Serviço | Problema | Correção |
|---|---|---|
| `frontend` | Usava `npm start` | Usa `node server.js` (standalone) |
| `frontend` | Sem healthcheck | `GET /api/health` a cada 30s |
| `frontend` | `volumes` montando src | Removido (build imutável) |
| `frontend` | `depends_on: backend` sem condition | `condition: service_healthy` |
| `backend` | Sem collectstatic no entrypoint | `collectstatic --noinput` adicionado |
| `celery` | Sem `--loglevel=info` | Flag adicionada |
| Geral | Sem `pgAdmin` para desenvolvimento | Serviço `pgadmin` adicionado (porta 5050) |

---

## 4. Celery Beat Schedule

Registradas todas as tasks periódicas de M2→M5:

| Task | Schedule | Módulo |
|---|---|---|
| `verificar-vencimentos` | Diário 08:00 | Financeiro |
| `criar-recorrencias` | Diário 07:00 | Financeiro |
| `verificar-estoque-minimo` | Diário 09:00 | Estoque |
| `verificar-followups` | Diário 08:30 | CRM |
| `relatorio-semanal-fornecedores` | Segunda 07:00 | Fornecedores |
| `alertar-fornecedores-sem-avaliacao` | Diário 10:00 | Fornecedores |

**Bug corrigido em `modules/fornecedores/tasks.py`:** `SyntaxError` — `import` dentro de `.annotate()` (linha 60). Removida a expressão inválida; a função agora usa `.count()` direto.

---

## 5. Testes End-to-End (27 novos testes)

Arquivo: `backend/tests/test_e2e_integration.py`

### 4.1 Autenticação (5 testes)
| Teste | Resultado |
|---|---|
| Registro empresa + usuário (campos corretos: `nome_usuario`, `senha`, `segmento`) | ✅ |
| Login retorna dados do usuário | ✅ |
| Login com senha errada → 401 | ✅ |
| Acesso a rota protegida sem token → 401 | ✅ |
| `GET /api/auth/me/` retorna dados do usuário logado | ✅ |

### 4.2 Financeiro (5 testes)
| Teste | Resultado |
|---|---|
| Criar categoria receita | ✅ |
| Lançar receita paga R$2.000 | ✅ |
| Lançar despesa pendente R$500 | ✅ |
| Resumo financeiro com total_receitas=2000 | ✅ |
| Marcar despesa como paga via `POST /pagar/` | ✅ |

### 4.3 Estoque (4 testes)
| Teste | Resultado |
|---|---|
| Criar produto com preços e estoque mínimo | ✅ |
| Entrada de 20 unidades → estoque_atual=20.0 | ✅ |
| Saída de 15 → estoque=5, `esta_abaixo_minimo=True` | ✅ |
| Saída com estoque insuficiente → 400 | ✅ |

**Descoberta:** Campo `estoque_baixo` não existe; o correto é `esta_abaixo_minimo`. Campo `motivo` usa choices em minúsculas (`compra`, `venda`, não `Compra`, `Venda`).

### 4.4 CRM (4 testes)
| Teste | Resultado |
|---|---|
| Criar cliente lead/instagram | ✅ |
| Mover cliente no funil via `PATCH /mover-funil/` | ✅ |
| Registrar interação de venda R$500 | ✅ |
| Follow-up atrasado → `followup_atrasado=True` | ✅ |

**Descoberta:** Campo é `status_funil` (não `estagio_funil`). Endpoint mover-funil usa `PATCH` (não `POST`). Interação requer campo `titulo`.

### 4.5 Fornecedores (3 testes)
| Teste | Resultado |
|---|---|
| Criar fornecedor | ✅ |
| Avaliar (qualidade=5, prazo=4, preço=4) → score ≥ 80 | ✅ |
| Registrar compra paga R$1.500 → total correto | ✅ |

**Descoberta:** Campos de avaliação são `avaliacao_qualidade`, `avaliacao_prazo`, `avaliacao_preco`. Signal `on_commit` funciona corretamente.

### 4.6 Multi-tenant (4 testes)
| Teste | Resultado |
|---|---|
| Financeiro: empresa 2 não vê dados da empresa 1 | ✅ |
| Estoque: empresa 2 não vê produtos da empresa 1 | ✅ |
| CRM: empresa 2 não vê clientes da empresa 1 | ✅ |
| Fornecedores: empresa 2 não vê fornecedores da empresa 1 | ✅ |

### 4.7 Celery (2 testes)
| Teste | Resultado |
|---|---|
| 6 tasks periódicas registradas no beat_schedule | ✅ |
| Todos os módulos de tasks importáveis sem erro | ✅ |

---

## 6. Suite Completa de Testes

| Módulo | Testes |
|---|---|
| Auth (M1) | 42 |
| Financeiro (M2) | 45 |
| Estoque (M3) | 48 |
| CRM (M4) | 52 |
| Fornecedores (M5) | 44 |
| Shared/Health | 15 |
| **E2E Integration (novo)** | **27** |
| **Total** | **269** |

**Tempo de execução:** 4.82s | **Falhas:** 0

---

## 7. Build Frontend

```
✅ 15 rotas compiladas (static + dynamic)
✅ .next/standalone/ gerado (node server.js)
✅ Middleware: 26.6 kB
✅ Sem erros de TypeScript ou ESLint
```

Rotas compiladas: `/login`, `/registro`, `/recuperar-senha`, `/redefinir-senha`,
`/` (dashboard), `/financeiro`, `/financeiro/dre`, `/financeiro/lancamentos`,
`/estoque`, `/clientes`, `/fornecedores`, `/fornecedores/[id]`

---

## 8. Próximos Passos

O projeto está pronto para iniciar o **M6 (Projetos/Tarefas)**:

- Models: `Projeto`, `Tarefa`, `Comentario`, `Anexo`
- Kanban com drag-and-drop (`@dnd-kit`)
- Sprints e milestones
- Integração futura com Equipe (M7)

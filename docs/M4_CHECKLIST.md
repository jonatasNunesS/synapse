# M4 — CRM de Clientes: Checklist de Validação

## Resultados dos Testes

| Métrica | Resultado |
|---|---|
| Testes backend | **199 passando** (48 novos M4 + 151 anteriores) |
| Build frontend | **✅ Compilado sem erros** |
| Páginas geradas | `/clientes` (20.1 kB) + `/clientes/[id]` (5.68 kB) |

---

## Roteiro de Testes Manuais

### 1. Listagem de Clientes

- [ ] `GET /api/clientes/` retorna lista paginada (max 25)
- [ ] Filtro por `status_funil=lead` retorna apenas leads
- [ ] Filtro por `origem=instagram` retorna apenas de Instagram
- [ ] Filtro por `busca=João` retorna clientes com "João" no nome/email/telefone
- [ ] Filtro por `followup_atrasado=true` retorna clientes com follow-up vencido
- [ ] Multi-tenant: usuário da empresa B não vê clientes da empresa A

### 2. CRUD de Clientes

- [ ] `POST /api/clientes/` cria cliente com dados válidos → 201
- [ ] `POST /api/clientes/` com nome vazio → 400 com mensagem de erro
- [ ] `POST /api/clientes/` com e-mail inválido → 400
- [ ] `GET /api/clientes/{id}/` retorna detalhe com todos os campos calculados
- [ ] `PATCH /api/clientes/{id}/` atualiza campos parcialmente → 200
- [ ] `DELETE /api/clientes/{id}/` faz soft delete (ativo=False) → 204
- [ ] `GET /api/clientes/{id}/` após delete → 404

### 3. Funil Kanban

- [ ] `GET /api/clientes/funil/` retorna clientes agrupados por status + totais
- [ ] `PATCH /api/clientes/{id}/mover-funil/` com status válido → 200
- [ ] `PATCH /api/clientes/{id}/mover-funil/` com status inválido → 400
- [ ] Após mover, `GET /api/clientes/funil/` reflete a mudança (cache invalidado)

### 4. Resumo / KPIs

- [ ] `GET /api/clientes/resumo/` retorna total_clientes, novos_este_mes, valor_total_vendas, ticket_medio, followups_hoje, followups_atrasados
- [ ] Valores calculados corretamente após criar interação de venda

### 5. Interações

- [ ] `POST /api/clientes/{id}/interacoes/` com tipo=venda e valor=500 → 201
- [ ] Signal pós-save: cliente.valor_total_compras e quantidade_compras atualizados
- [ ] Signal pós-save: cliente.ultima_compra atualizada
- [ ] Signal pós-save: cliente.proximo_followup atualizado se informado
- [ ] `GET /api/clientes/{id}/interacoes/` retorna lista ordenada por data_interacao desc
- [ ] `POST /api/clientes/{id}/interacoes/` de empresa B em cliente da empresa A → 404

### 6. Follow-ups

- [ ] `GET /api/clientes/followups/?dias=3` retorna clientes com follow-up nos próximos 3 dias
- [ ] `GET /api/clientes/followups/atrasados/` retorna clientes com follow-up vencido

### 7. Cache Redis

- [ ] `GET /api/clientes/resumo/` segunda chamada usa cache (verificar logs)
- [ ] `POST /api/clientes/` invalida cache do módulo
- [ ] `PATCH /api/clientes/{id}/mover-funil/` invalida cache do funil

### 8. Frontend

- [ ] `/clientes` carrega com KPIs, tabela e toggle Lista/Kanban
- [ ] Botão "Novo" abre modal com formulário de 12 campos
- [ ] Formulário valida campos obrigatórios antes de enviar
- [ ] Filtros de status e origem funcionam em tempo real
- [ ] Toggle Kanban mostra 6 colunas com drag-and-drop funcional
- [ ] Arrastar card de coluna A para coluna B chama API e persiste
- [ ] `/clientes/{id}` mostra perfil completo + KPIs + timeline de interações
- [ ] Botão "Nova Interação" abre modal com seleção visual de tipo
- [ ] Interação do tipo "Venda" exibe campo de valor
- [ ] Após registrar interação de venda, valor_total_compras é atualizado
- [ ] Link WhatsApp abre no navegador com número correto
- [ ] Responsivo em 375px: tabela com scroll horizontal, Kanban com scroll

---

## Endpoints Implementados

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/clientes/` | Listagem com 6 filtros + paginação |
| POST | `/api/clientes/` | Criar cliente |
| GET | `/api/clientes/{id}/` | Detalhe com campos calculados |
| PATCH | `/api/clientes/{id}/` | Atualizar parcialmente |
| DELETE | `/api/clientes/{id}/` | Soft delete |
| PATCH | `/api/clientes/{id}/mover-funil/` | Mover no funil |
| GET | `/api/clientes/{id}/interacoes/` | Histórico de interações |
| POST | `/api/clientes/{id}/interacoes/` | Registrar interação |
| GET | `/api/clientes/funil/` | Funil Kanban agrupado |
| GET | `/api/clientes/resumo/` | KPIs do módulo |
| GET | `/api/clientes/followups/` | Follow-ups próximos |
| GET | `/api/clientes/followups/atrasados/` | Follow-ups atrasados |

---

## Aprovação do M4

- [ ] Happy path testado manualmente
- [ ] Dados inválidos testados (400 com mensagens claras)
- [ ] Acesso negado testado (multi-tenant validado)
- [ ] Cache implementado e invalidação verificada
- [ ] Responsivo em 375px e 1280px
- [ ] **M4 APROVADO** → Iniciar M5 (Fornecedores)

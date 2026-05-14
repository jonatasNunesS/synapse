# M2 — Gestão Financeira: Checklist de Validação

## Resultados Automatizados

| Métrica | Resultado |
|---|---|
| Testes backend (total acumulado) | ✅ 110 passando (45 novos M2 + 65 anteriores) |
| Build frontend | ✅ Compilado sem erros (TypeScript + ESLint) |
| Rotas geradas | `/financeiro`, `/financeiro/lancamentos`, `/financeiro/dre` |
| Migrations criadas | ✅ `modules/financeiro/migrations/0001_initial.py` |

---

## Endpoints da API

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/financeiro/resumo/` | KPIs do mês (receitas, despesas, saldo, pendente, atrasado) |
| GET | `/api/financeiro/fluxo-caixa/` | Fluxo diário por período |
| GET | `/api/financeiro/dre/` | DRE por categoria com margem |
| GET/POST | `/api/financeiro/lancamentos/` | Listar (filtros) / Criar lançamento |
| GET/PATCH/DELETE | `/api/financeiro/lancamentos/{id}/` | Detalhe / Atualizar / Excluir |
| POST | `/api/financeiro/lancamentos/{id}/pagar/` | Marcar como pago |
| GET/POST | `/api/financeiro/categorias/` | Listar / Criar categoria |
| GET/PATCH/DELETE | `/api/financeiro/categorias/{id}/` | Detalhe / Atualizar / Excluir |

---

## Testes Manuais — Happy Path

### 1. Criar Lançamento de Receita
```
POST /api/financeiro/lancamentos/
{
  "tipo": "receita",
  "descricao": "Venda de produto",
  "valor": "1500.00",
  "data_vencimento": "2026-05-15",
  "status": "pago",
  "data_pagamento": "2026-05-14"
}
Esperado: 201 Created, success: true
```

### 2. Criar Lançamento de Despesa
```
POST /api/financeiro/lancamentos/
{
  "tipo": "despesa",
  "descricao": "Aluguel",
  "valor": "800.00",
  "data_vencimento": "2026-05-10",
  "status": "pendente"
}
Esperado: 201 Created, success: true
```

### 3. Verificar Resumo do Mês
```
GET /api/financeiro/resumo/?mes=5&ano=2026
Esperado: total_receitas: 1500, total_despesas: 0 (despesa pendente), saldo: 1500
```

### 4. Marcar Despesa como Paga
```
POST /api/financeiro/lancamentos/{id}/pagar/
{"data_pagamento": "2026-05-14"}
Esperado: 200 OK, status: "pago"
```

### 5. Verificar DRE
```
GET /api/financeiro/dre/?mes=5&ano=2026
Esperado: receitas_por_categoria, despesas_por_categoria, lucro_bruto, margem
```

### 6. Fluxo de Caixa
```
GET /api/financeiro/fluxo-caixa/?data_inicio=2026-05-01&data_fim=2026-05-31
Esperado: lista de {data, receitas, despesas, saldo_dia, saldo_acumulado}
```

---

## Testes de Dados Inválidos

- `POST /api/financeiro/lancamentos/` com `valor: -100` → 400 Bad Request
- `POST /api/financeiro/lancamentos/` com `status: "pago"` sem `data_pagamento` → 400 Bad Request
- `POST /api/financeiro/lancamentos/` sem `descricao` → 400 Bad Request

---

## Testes de Acesso Negado (Multi-Tenant)

- Usuário da Empresa A não consegue ver lançamentos da Empresa B → 403 Forbidden
- Usuário não autenticado em qualquer endpoint → 401 Unauthorized

---

## Testes de Cache Redis

- Primeira chamada a `/api/financeiro/resumo/` → busca no banco
- Segunda chamada idêntica → retorna do cache Redis (TTL 24h)
- Após criar/editar lançamento → cache invalidado automaticamente

---

## Testes de Responsividade (Frontend)

### 375px (Mobile)
- [ ] Cards de resumo em 2 colunas
- [ ] Tabela de lançamentos com scroll horizontal
- [ ] Modal de formulário ocupa tela inteira
- [ ] Navegação de mês funcional

### 1280px (Desktop)
- [ ] Cards de resumo em 4 colunas
- [ ] Sidebar visível com labels
- [ ] Gráfico de fluxo de caixa em largura total
- [ ] Filtros da página de lançamentos em linha

---

## Funcionalidades Implementadas

### Backend
- [x] Model `Categoria` com tipo (receita/despesa), cor e ícone
- [x] Model `Lancamento` com todos os campos do spec (recorrência, parcelamento)
- [x] Repository com aggregations Django ORM (sem raw SQL)
- [x] Service com cache Redis (chave `synapse:{empresa_id}:financeiro:{tipo}`)
- [x] Invalidação automática de cache em create/update/delete
- [x] Task Celery: `processar_lancamentos_recorrentes` (diária)
- [x] Task Celery: `atualizar_status_atrasados` (diária)
- [x] Task Celery: `gerar_relatorio_mensal` (mensal)
- [x] Admin Django com filtros, busca e ações em lote
- [x] Multi-tenant em todos os endpoints (empresa_id obrigatório)
- [x] Paginação obrigatória (max 25 itens)
- [x] 45 testes cobrindo happy path, dados inválidos, acesso negado e cache

### Frontend
- [x] Página `/financeiro` com KPIs + gráfico fluxo de caixa + tabela resumida
- [x] Página `/financeiro/lancamentos` com filtros completos e paginação
- [x] Página `/financeiro/dre` com gráficos de pizza por categoria
- [x] Componente `ResumoCards` com 4 KPIs
- [x] Componente `FluxoCaixaChart` com Recharts (área + barras)
- [x] Componente `LancamentoTable` com status badges e ações inline
- [x] Componente `LancamentoForm` com React Hook Form + Zod
- [x] Componente `PagarModal` para confirmar pagamento
- [x] Navegação de mês com setas
- [x] Sidebar: item "Financeiro" habilitado

---

## Como Testar Localmente

```bash
cd synapse
docker-compose up -d
# Aguardar ~30s para os serviços subirem

# Criar usuário e empresa via registro
curl -X POST http://localhost:8000/api/auth/registro/ \
  -H "Content-Type: application/json" \
  -d '{"nome":"Fundador","email":"fundador@synapse.com","senha":"Synapse@123","empresa_nome":"Synapse Ltda","plano":"starter"}'

# Acessar frontend
open http://localhost:3000
```

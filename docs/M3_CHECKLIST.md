# ✅ M3 — Controle de Estoque: Checklist de Validação

## Resultados Técnicos

| Métrica | Resultado |
|---|---|
| Testes backend | **150 passando** (40 novos M3 + 110 anteriores) |
| Build frontend | **✅ Compilado sem erros** (TypeScript + ESLint) |
| Arquivos criados | 22 novos arquivos |
| Rotas frontend | `/estoque`, `/estoque/produtos/[id]` |

---

## Roteiro de Testes Manuais

### 1. Pré-requisito: Ambiente rodando

```bash
cd synapse
docker-compose up -d
```

Aguarde todos os serviços subirem (~30s). Acesse http://localhost:3000.

---

### 2. Happy Path — Fluxo Completo

#### 2.1 Criar Categoria
- Acesse **Estoque** na sidebar
- Abra o console do navegador e execute:
  ```js
  fetch('/api/estoque/categorias/', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({nome: 'Eletrônicos', cor: '#6366f1'})
  }).then(r => r.json()).then(console.log)
  ```
- Esperado: `{"success": true, "data": {...}}`

#### 2.2 Criar Produto
- Clique em **"Novo Produto"**
- Preencha: Nome = "Notebook Pro", SKU = "NB-001", Unidade = "Unidade"
- Preço Custo = 2500, Preço Venda = 3500, Estoque Mínimo = 5
- Clique em **Salvar**
- Esperado: produto aparece na tabela com status **"Zerado"** (vermelho)

#### 2.3 Registrar Entrada
- Clique no produto para abrir o detalhe
- Clique em **"Movimentação"**
- Tipo = Entrada, Quantidade = 20, Motivo = Compra, Referência = "NF-001"
- Clique em **Registrar**
- Esperado: estoque atual = 20, status muda para **"OK"** (verde)

#### 2.4 Registrar Saída
- Clique em **"Movimentação"** novamente
- Tipo = Saída, Quantidade = 17, Motivo = Venda
- Clique em **Registrar**
- Esperado: estoque atual = 3, status muda para **"Baixo"** (amarelo)
- Esperado: produto aparece nos **Alertas de Estoque**

#### 2.5 Verificar Histórico
- Na página de detalhe do produto, o histórico deve mostrar:
  - Entrada de +20 (NF-001)
  - Saída de -17
  - Saldo: 20 → 3

---

### 3. Dados Inválidos

| Cenário | Ação | Esperado |
|---|---|---|
| Produto sem nome | Criar produto sem preencher nome | Erro "Nome é obrigatório" |
| Quantidade negativa | Movimentação com quantidade -5 | Erro de validação |
| Saída maior que estoque | Saída de 100 com estoque 3 | Erro "Estoque insuficiente" |
| SKU duplicado | Criar dois produtos com mesmo SKU | Erro de duplicidade |

---

### 4. Acesso Negado (Multi-tenant)

- Faça login com usuário de outra empresa
- Tente acessar `/api/estoque/produtos/` via curl com token de empresa B
- Esperado: retorna lista vazia (não vê produtos da empresa A)

---

### 5. Cache Redis

```bash
docker-compose exec redis redis-cli
KEYS synapse:*:estoque:*
```

Esperado: chaves de cache criadas após primeiro acesso ao resumo/produtos.

---

### 6. Responsividade

| Breakpoint | Verificação |
|---|---|
| 375px (mobile) | Tabela de produtos com scroll horizontal, cards empilhados |
| 1280px (desktop) | Layout 3 colunas (alertas + tabela), sidebar expandida |

---

### 7. Admin Django

- Acesse http://localhost:8000/admin/
- Verifique: **CategoriaEstoque**, **Produto**, **Movimentacao** listados
- Produto deve mostrar badge colorido de status no admin

---

## Endpoints Implementados

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/estoque/resumo/` | KPIs: total produtos, valor, alertas |
| GET | `/api/estoque/alertas/` | Produtos com estoque baixo/zerado |
| GET | `/api/estoque/relatorio/` | Relatório completo com movimentações |
| GET/POST | `/api/estoque/produtos/` | Listar (filtros) e criar produtos |
| GET/PATCH/DELETE | `/api/estoque/produtos/{id}/` | Detalhe, edição e exclusão |
| GET | `/api/estoque/produtos/{id}/movimentacoes/` | Histórico de movimentações |
| POST | `/api/estoque/movimentacoes/` | Registrar movimentação |
| GET/POST | `/api/estoque/categorias/` | Listar e criar categorias |
| GET/PATCH/DELETE | `/api/estoque/categorias/{id}/` | Detalhe, edição e exclusão |

---

## Aprovação do Milestone

- [ ] Happy path testado manualmente
- [ ] Dados inválidos rejeitados corretamente
- [ ] Acesso negado entre empresas validado
- [ ] Cache Redis funcionando
- [ ] Responsivo em 375px e 1280px
- [ ] Admin Django funcional

**Quando todos os itens estiverem marcados, M3 está aprovado para avançar ao M4 (CRM).**

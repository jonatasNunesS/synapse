# 🔍 Diagnóstico — As métricas do cliente não vêem a Venda

**Data:** 2026-10-14
**Base:** `master` @ `af0dc1b` (head confirmado no GitHub antes de ramificar)
**Branch:** `diag/metricas-venda`
**Natureza:** diagnóstico. **Nenhuma linha de código de produção foi alterada.** O único artefato é este documento.
**Método:** leitura de código, varredura e **verificação em execução** — três sondas temporárias criadas, medidas e apagadas; nenhum arquivo de teste ficou no repositório.

---

## 1. A causa, em uma frase

`Cliente.valor_total_compras` e os três campos vizinhos são **colunas gravadas**, não cálculos. Quem as grava é um único `post_save` em `InteracaoCliente`. O módulo `vendas` **não tem signal nenhum** — `VendasConfig` não tem `ready()` e `modules/vendas/signals.py` não existe — e nenhuma linha dele menciona `ClienteRepository`, `valor_total_compras` ou `status_funil`.

```
$ grep -rn "ClienteRepository\|_recalcular_agregados\|valor_total_compras\|status_funil" backend/modules/vendas/
(nenhum resultado)
```

Não é uma conta errada: é uma **escrita que nunca acontece**. A tela mostra `0.00` porque é o `default=0` da coluna, intocado desde que o cliente foi criado.

### O que torna isto diferente de um esquecimento

O frontend **já assume o contrato que o backend não tem**, e está escrito. Em `app/(dashboard)/clientes/[id]/page.tsx:636`, ao fechar o detalhe de uma venda:

```tsx
// Baixar ou lançar muda os badges da linha; o cliente relê porque
// o lançamento entra nos agregados dele.
recarregarVendas();
recarregarCliente();
```

A tela recarrega o cliente de propósito, para ver os agregados mudarem. Eles não mudam. O comentário descreve um comportamento que nunca existiu no fluxo novo — e é por isso que ninguém notou: **o lado que consome documenta a promessa, e o lado que deveria cumpri-la nunca soube dela.**

### Medido em execução

Cliente novo, empresa nova, sonda descartável:

| passo | `valor_total_compras` | `qtd` | `ultima_compra` | `ticket_medio` | `status_funil` |
|---|---|---|---|---|---|
| A. cliente recém-criado | `0.00` | 0 | `None` | `0` | `lead` |
| B. **Venda de R$ 450 criada** | **`0.00`** | **0** | **`None`** | **`0`** | `lead` |
| C. **venda fiada de R$ 100 confirmada** | **`0.00`** | **0** | **`None`** | **`0`** | `lead` |
| D. `InteracaoCliente` tipo=venda R$ 450 | `450.00` | 1 | `2026-10-14` | `450.00` | `lead` |

E o reflexo nos KPIs, na mesma sonda:

| | depois da Venda de R$ 450 | depois da interação de R$ 450 |
|---|---|---|
| `calcular_resumo` → `valor_total_gerado` | **0** | 450 |
| `calcular_resumo` → `ticket_medio_geral` | **0** | 450 |
| `_valor_gerado_no_periodo` (mês atual) | **0** | 450 |

O relato do QA está exato: R$ 450 vendidos, R$ 0 em toda métrica. **Criar e confirmar são igualmente invisíveis** — não é um gatilho que falta no momento errado, é a ausência de qualquer gatilho.

---

## 2. Mapa: quem alimenta o quê, hoje

### 2.1 — Os agregados do cliente

| Campo | Como existe | Quem escreve | Venda dispara? |
|---|---|---|---|
| `valor_total_compras` | coluna `DecimalField(default=0)` | `clientes/signals.py` → `ClienteRepository._recalcular_agregados_venda` | ❌ |
| `valor_recebido` | coluna | o mesmo | ❌ |
| `valor_a_receber` | coluna | o mesmo | ❌ |
| `quantidade_compras` | coluna `IntegerField(default=0)` | o mesmo | ❌ |
| `ultima_compra` | coluna `DateField(null=True)` | o mesmo | ❌ |
| `ticket_medio` | **`@property`** = `valor_total_compras / quantidade_compras` | derivada — herda o zero | ❌ |

O gatilho, confirmado:

```python
# clientes/signals.py
@receiver(post_save, sender="synapse_clientes.InteracaoCliente")
def atualizar_cliente_apos_interacao(sender, instance, created, **kwargs):
    if instance.tipo == "venda":
        ClienteRepository._recalcular_agregados_venda(instance.cliente_id)
```

Um `sender` só, e é `InteracaoCliente`. O recálculo (`repository.py:339`) lê `InteracaoCliente.objects.filter(cliente_id=…, tipo="venda")` — a palavra `Venda` não aparece na função.

**Nota a favor do que está lá:** o recálculo é *full*, não incremental — ele reconstrói a verdade da fonte a cada save, inclusive em edição e exclusão. É a decisão certa e ela não precisa mudar; o que falta é a segunda fonte.

### 2.2 — O dashboard

Aqui a resposta não é uniforme, e a diferença importa:

| Bloco do dashboard | Lê | Venda aparece? |
|---|---|---|
| KPI **Ticket médio** + subtítulo "Total gerado" (`KPIGrid.tsx:185`) | `Cliente.valor_total_compras` | ❌ nunca |
| KPI **Receitas / Despesas / A receber** | `Lancamento` (via `FinanceiroService`) | ⚠️ **sim, mas só depois** de alguém apertar "lançar no financeiro" |
| **Fluxo de caixa** (`FluxoCaixaWidget`) | `Lancamento` | ⚠️ idem |
| **Funil de vendas** (`FunilWidget`) | `Cliente.status_funil` | ❌ (ver 2.3) |
| **Atividade recente** (`AtividadeWidget`) | `InteracaoCliente` + `Movimentacao` + `Lancamento` | ❌ a Venda **não entra no feed** (`dashboard/services.py:644`) |
| **Follow-ups / Vencimentos** | `Cliente.proximo_followup` / `Lancamento` | — |

`modules/dashboard/services.py` **não importa `modules.vendas` uma única vez** (`grep -c` → 0). Tudo que o dashboard sabe de uma venda nova, ele sabe de segunda mão, pelo `Lancamento` — e só se a integração manual foi feita. `VendaService.criar` diz isso explicitamente:

> *"As integrações NÃO acontecem aqui. Quem baixa estoque e quem lança no financeiro é a pessoa, pelos endpoints abaixo, depois de ver o que vai acontecer. Automatizar aqui tiraria dela a decisão."*

É uma decisão de produto defensável — mas tem como consequência que **uma venda só vira receita no dashboard quando alguém clica**. Enquanto não clicam, a venda existe, a timeline mostra, e nenhum número do sistema a conhece.

### 2.3 — Promoção de funil: não existe, e nunca existiu

A hipótese do enunciado é que a promoção automática existiria no fluxo antigo e teria se perdido. **Ela não existe em nenhum dos dois.**

`status_funil` é escrito em exatamente três lugares, e nenhum é automático:

| Onde | O que faz |
|---|---|
| `clientes/views.py:164` → `repository.mover_funil` | o endpoint do arrastar do Kanban — ação explícita de uma pessoa |
| `clientes/admin.py:94` | ação em massa do admin, e move **para `lead`** |
| `Cliente.status_funil` default | `"lead"` |

O signal de `InteracaoCliente` recalcula agregados e puxa o follow-up — e **não toca no funil**. Medido: no passo D da sonda, com uma venda paga de R$ 450 registrada pelo fluxo antigo, `status_funil` continuou `lead`.

Então "a venda deve promover o Lead?" é uma pergunta **nova**, de produto, não a restauração de algo que quebrou. Está na seção 6.

### 2.4 — A timeline está certa, e isso localiza a correção

`listar_interacoes` (`repository.py:373`) filtra `migrada_para_venda__isnull=True`, com a razão escrita: mostrar as duas faria a mesma compra aparecer duplicada. O frontend junta as duas listas em `lib/vendas.ts:montarHistorico`, que também documenta a dedup.

Resultado: **duas funções no mesmo arquivo, com regras opostas sobre a mesma tabela.**

| Função | Filtra a interação migrada? | Está certa? |
|---|---|---|
| `listar_interacoes` (timeline) | ✅ sim | ✅ sim |
| `_recalcular_agregados_venda` (métricas) | ❌ não | ✅ sim — **hoje** |

As duas estão certas hoje por caminhos diferentes: a timeline porque exclui a antiga e mostra a nova; a métrica porque **não** exclui a antiga e não conhece a nova. Somar a Venda à métrica sem herdar o filtro da timeline quebra a segunda. É o item 4 abaixo.

---

## 3. O que a Venda atualiza (e o que não)

| Ação | Toca algum agregado do cliente? | Toca o quê |
|---|---|---|
| `VendaService.criar` | ❌ | `Venda` + `ItemVenda`, `recalcular_totais()` |
| `VendaService.atualizar` | ❌ | idem |
| `VendaService.deletar` | ❌ | apaga (helper `apagar_com_ajustes`) |
| `baixar_estoque` | ❌ | `Movimentacao` |
| `lancar_financeiro` | ❌ *(indiretamente: cria `Lancamento`, que o dashboard lê)* | `Lancamento` + vínculo |
| `confirmar_pagamento` | ❌ **medido** | `valor_recebido`, `status_pagamento`, `Lancamento` |
| `adiar_pagamento` / `cancelar_pagamento` | ❌ | `data_prevista_pagamento`, `notificacao_enviada` |
| `vincular_cliente` | ❌ **e é deliberado** | só `venda.cliente` |

`vincular_cliente` merece destaque porque o docstring dele já enuncia a regra que a correção vai ter de respeitar:

> *"Põe, troca ou tira o cliente de uma venda. E não faz mais nada. Vínculo é organização; pagamento é fato."*

Com os agregados passando a ler Venda, **esse endpoint deixa de poder não fazer mais nada**: trocar o dono de uma venda de R$ 450 passa a ter de tirar 450 de um cliente e pôr em outro. A frase continua verdadeira para o dinheiro (o `Lancamento` não se move), mas não para os agregados. É uma consequência a decidir, não um detalhe.

### As vendas novas e as 22 migradas

| | Aparece na métrica? | Aparece na timeline? |
|---|---|---|
| **Venda nova** (criada no fluxo novo) | ❌ não | ✅ sim |
| **Venda migrada** (as 22 da fase 2) | ✅ **sim — pela interação original** | ✅ sim (a Venda; a interação é escondida) |

As 22 migradas têm métrica **certa por acidente**: a migração não apagou a `InteracaoCliente` original ("REGRA DE OURO: nada é apagado"), e é ela que ainda alimenta o agregado. Medido com um cliente nesse estado exato (1 Venda de R$ 200 + a interação original vinculada): total `200.00`, qtd `1` — correto. A timeline mostra `0` interações + `1` venda, também correto.

**Então a correção não é "os números estão zerados": é "os números estão certos para 22 vendas e zerados para todas as seguintes" — por duas razões diferentes.**

---

## 4. A armadilha da correção: dupla contagem

Medido no mesmo cliente migrado:

| Abordagem | Resultado | A venda real foi |
|---|---|---|
| **Hoje** (só interações, migrada inclusa) | `200` | 200 ✅ |
| **Correção ingênua** (interações + vendas) | **`400`** | 200 ❌ |
| **Correção certa** (vendas + interações **não** migradas) | `200` | 200 ✅ |

A regra já existe no repositório, em `listar_interacoes`. A correção precisa de **uma linha** a mais do que parece:

```python
# o que falta no agregado, não só somar Venda:
InteracaoCliente.objects.filter(cliente_id=…, tipo="venda", migrada_para_venda__isnull=True)
```

### E uma segunda armadilha, no mapeamento de status

`Venda.STATUS_PAGAMENTO_CHOICES` tem três valores (`pago`, `pendente`, `cancelado`). A interação tem **quatro** — o extra é `nao_se_aplica` (venda à vista). O comando de migração mapeia os dois que não existem assim:

```python
STATUS_SEM_EQUIVALENTE = {"cancelado", "nao_se_aplica"}  # → ambos viram "pendente"
```

Cruzando com o que o agregado faz hoje (`repository.py:330-337`):

| Interação original | Hoje conta como | Virou Venda com status | Se o agregado ler Venda, conta como |
|---|---|---|---|
| `pago` | recebido | `pago` | recebido ✅ |
| `pendente` | a receber | `pendente` | a receber ✅ |
| **`nao_se_aplica`** (à vista) | **recebido** | `pendente` | **a receber** ❌ muda de coluna |
| **`cancelado`** | **excluída do total** | `pendente` | **entra no total** ❌ inventa dinheiro |

O segundo é o grave: uma venda cancelada que a migração converteu em "pendente" passaria a **somar ao faturamento** do cliente. O rastro está preservado na observação da Venda (`[migrado de status: cancelado]`), então é recuperável — mas por *string*, não por campo. Quantas das 22 estão nesses dois estados é mensurável no banco de staging; a query está na seção 7.

> **O docstring de `_recalcular_agregados_venda` explica por que `nao_se_aplica` conta como recebido** — "venda à vista: o dinheiro já entrou" — e diz que foi o conserto de um bug anterior do painel de receita. Ler Venda sem resolver este mapeamento **reintroduz esse bug** para as vendas migradas.

---

## 5. Interação com o B9 (fuso)

### 5.1 — O B9, medido

`frontend/components/vendas/VendaForm.tsx:43`:

```ts
const hoje = () => new Date().toISOString().slice(0, 10);   // ← UTC
```

`toISOString()` é UTC. São Paulo é UTC−3, então **das 21:00 à meia-noite o "hoje" do formulário é amanhã**:

| instante em São Paulo | `hoje()` devolve | correto |
|---|---|---|
| 14/10 20:59 | `2026-10-14` | `2026-10-14` |
| **14/10 21:00** | **`2026-10-15`** | `2026-10-14` |
| **31/10 21:30** | **`2026-11-01`** | `2026-10-31` ← **vira o mês** |

O campo é `required=False` no serializer e o model tem o default **certo** (`data_venda = models.DateField(default=timezone.localdate)`), mas o formulário **sempre manda o campo** (`VendaForm.tsx:131`), então o default correto nunca roda.

**Há uma segunda fonte, no backend.** `timezone.localdate` aparece **uma vez** em todo `modules/` — exatamente nesse default. `date.today()` aparece **62 vezes**. `date.today()` usa o fuso do SO, não o `TIME_ZONE` do Django:

```
Container em UTC; TIME_ZONE do Django = America/Sao_Paulo
instante em São Paulo    date.today()   localdate()   diverge?
2026-10-31 20:59         2026-10-31     2026-10-31
2026-10-31 21:00         2026-11-01     2026-10-31    <<< SIM
```

Entre elas está `lancar_financeiro`, que usa `hoje = date.today()` como `data_pagamento`. Então o B9 não é um ponto: é uma classe, com uma ocorrência no front e 62 candidatas no back.

### 5.2 — Os dois bugs não se somam: um esconde o outro

Esta é a resposta à pergunta do enunciado, e ela é melhor que o esperado — e pior.

**O filtro "Mês" do CRM não exclui a venda de amanhã. Ele não vê a venda, ponto.** `_valor_gerado_no_periodo` lê `InteracaoCliente.data_interacao`, e a Venda não está lá. Medido: a venda de R$ 450 com `data_venda = 2026-11-01` dá **0 em outubro e 0 em novembro** — porque dá 0 em qualquer mês.

E o fluxo antigo era **correto no fuso**. `data_interacao` é `DateTimeField` e o lookup `__month` com `USE_TZ=True` converte para `America/Sao_Paulo` no próprio SQL. Medido com uma interação em 31/10 às 23:30 SP:

```
_valor_gerado_no_periodo(outubro)  = 450   ✅
_valor_gerado_no_periodo(novembro) = 0
```

Agora o mesmo valor, com a data que o formulário grava, lido de `Venda.data_venda`:

```
Venda gravada com data_venda = 2026-11-01
se o KPI lesse Venda.data_venda: outubro  = 0     ❌
se o KPI lesse Venda.data_venda: novembro = 450
```

> ### ⚠️ Corrigir o B10 sozinho **cria** um erro de fechamento de mês que hoje não existe.
>
> Hoje a venda de 31/10 às 23:30 não aparece em mês nenhum — erro grosseiro, visível, que o QA achou. Depois de ligar a Venda ao KPI, ela aparece **em novembro** — erro discreto, que fecha o mês com o número errado e ninguém percebe. A categoria piora: de "zero óbvio" para "valor plausível no mês errado", que é a categoria que o `CODE_HEALTH_AUDIT` identificou como a mais cara deste projeto.
>
> **O B9 precisa entrar antes do B10, ou junto.** Não é preferência de ordem: é a diferença entre um bug que grita e um que não.

### 5.3 — Onde o B9 já morde hoje, sem o B10

Duas, independentes das métricas do CRM:

1. **A lista de Vendas** filtra `data_venda__gte/lte` (`vendas/services.py:47`). Uma venda das 21h cai fora do filtro "hoje".
2. **O dashboard, pelo financeiro.** `lancar_financeiro` grava `data_vencimento = venda.data_prevista_pagamento or venda.data_venda or hoje` — a data errada **propaga para o `Lancamento`**, e o fluxo de caixa do dashboard lê `Lancamento`. Então o B9 já chega ao dashboard hoje, por um caminho que o B10 não bloqueia.

---

## 6. Decisões que a correção exige

Levantadas, não decididas.

### 6.1 — Recalcular na hora **vs** signal em `Venda`

|  | **A) Signal em `Venda`** (como o antigo) | **B) `annotate`/property lendo `Venda`** |
|---|---|---|
| Como funciona | `post_save` em `Venda` chama o recálculo; colunas continuam gravadas | agregados saem de query no momento da leitura; colunas deixam de ser a verdade |
| **Pode dessincronizar?** | **Sim — é exatamente este bug.** Todo caminho de escrita novo precisa lembrar | **Não.** Impossível por construção |
| Custo de leitura | **zero** — a coluna já está lá | join/subquery em toda listagem, detalhe e KPI |
| Impacto no funil Kanban | nenhum: 6 `Sum("valor_total_compras")` sobre coluna indexada | os mesmos 6 `Sum` passam a agregar sobre **duas** tabelas unidas |
| Impacto no cache | o cache de `clientes` já é invalidado em `services.py:21,75`; passaria a precisar de invalidação disparada por `vendas` — **módulo cruzado** | cache por chave continua valendo; sem invalidação cruzada a inventar |
| Precedente no projeto | **dois**: `clientes` e `fornecedores/signals.py` — é o padrão da casa | **um**: `ESC-01`/`ESC-02` (Leva 1 e 6) moveram agregados de `@property` para `annotate`, pelo motivo oposto (custo de query) |
| Testes existentes | ~**47 asserções** em `tests/test_clientes.py` continuam valendo | as mesmas 47 passam a medir outra coisa; a semântica do split precisa ser re-decidida |
| Retro-população | **necessária** (seção 6.3) | **desnecessária** — a primeira leitura já traz o número certo |

**O que puxa para cada lado.** O argumento mais forte de (B) é que ele torna *este* bug impossível, e o bug já aconteceu: o padrão "coluna mantida por signal" foi acertado uma vez e a cópia seguinte nasceu sem a parte que o protegia — a mesma forma que o `CODE_HEALTH_AUDIT` registra como o padrão estrutural nº 1 desta base. O argumento mais forte de (A) é que ele é o padrão de dois módulos e não paga join em nenhuma leitura.

Vale notar uma **assimetria já existente** entre os dois signals da casa, que a decisão (A) precisaria resolver: `fornecedores` recalcula em `transaction.on_commit` com `select_for_update`; `clientes` recalcula **dentro** do signal, sem lock, com `.update()` direto. Se (A) for o caminho, o signal de `Venda` tem de escolher qual dos dois imitar — e o de `fornecedores` tem o comentário explicando por que o lock existe.

Há uma **terceira via** que o levantamento sugere e que eu registro sem recomendar: manter as colunas (leitura barata, retro-população única) **e** travar o buraco com teste de contrato — um teste que varra os caminhos de escrita de `Venda` e exija que cada um deixe os agregados batendo com a soma das fontes. É o remédio que a Leva 4 usou para o `} catch {`: não conserta o padrão, impede a próxima cópia de nascer errada.

### 6.2 — A Venda deve promover o Lead? *(decisão de produto)*

Não há o que restaurar: **a promoção automática nunca existiu** (seção 2.3). Então a pergunta é se ela deve passar a existir, e o levantamento deixa três subperguntas:

1. **Promover em qual evento?** Criar a venda, ou confirmar o pagamento? São estados diferentes: uma venda fiada criada é uma promessa; confirmada é dinheiro.
2. **Para qual status?** `fechado` é o fim do funil. Mas um cliente que compra todo mês viveria em `fechado`, e o Kanban perderia a informação de que há negociação em curso. `negociacao` → `fechado` ao confirmar é uma alternativa.
3. **Pode rebaixar?** Se a venda é apagada ou cancelada, o cliente volta ao status anterior? Hoje nada guarda qual era.

**Risco de escolher errado:** o funil é a tela que o fundador olha para saber o que fazer hoje. Mover cartões automaticamente tira dele o controle de uma informação que ele mantém à mão — e `admin.py` tem uma ação em massa para **voltar tudo para `lead`**, o que sugere que corrigir o funil à mão já é uma necessidade conhecida.

### 6.3 — Retro-população

Necessária **se e somente se** a decisão 6.1 for (A). São três populações distintas, e só a primeira é trivial:

| Grupo | Estado hoje | O que precisa |
|---|---|---|
| **Vendas novas** (pós-fase 2, sem interação) | agregado zerado | recálculo simples — a Venda é a única fonte |
| **22 migradas** | agregado **certo**, pela interação original | **não recalcular ingenuamente** — dobraria (seção 4) |
| **22 migradas com status convertido** | certo hoje; `nao_se_aplica` e `cancelado` viraram `pendente` na Venda | decidir a autoridade: a interação original (verdade) ou a Venda (o que a tela mostra) |

**Forma do mecanismo** — a decidir:

- **`manage.py` idempotente**, no molde de `migrar_vendas` (que já tem `--dry-run`, `--empresa`, e prova de que a soma bate ao centavo antes e depois). É o precedente mais próximo e o único que já provou funcionar nesta base.
- **Data migration**, que roda sozinha no deploy. Mais seguro contra esquecimento, mais difícil de inspecionar antes.
- **Nenhuma**, se a decisão for (B).

Em qualquer caso: o `migrar_vendas` estabeleceu a regra de ouro certa — **"o dinheiro é o que manda"**, a soma antes tem de bater com a soma depois, por empresa. A retro-população deve provar o mesmo, e isso só é possível se a autoridade sobre os status convertidos for decidida **antes** de rodar.

### 6.4 — Duas decisões que o levantamento encontrou e o enunciado não previa

**(i) `vincular_cliente` deixa de poder "não fazer mais nada".** Com os agregados lendo Venda, trocar o dono move R$ 450 de um cliente para outro. O docstring diz que vínculo não reescreve o que aconteceu com o dinheiro — continua certo para o `Lancamento`, deixa de ser para os agregados. Decidir: o endpoint recalcula os **dois** clientes (o antigo e o novo), ou o vínculo passa a ser imutável depois de haver dinheiro?

**(ii) "Ticket médio" do dashboard não é ticket de venda, e já não era.** `calcular_resumo` faz `Avg("valor_total_compras")` sobre **todos os clientes ativos** — incluindo quem nunca comprou. Medido: 10 clientes ativos, 1 venda de R$ 450 → o KPI mostra **R$ 45**.

| | hoje | o que a Venda permitiria |
|---|---|---|
| `Avg(Cliente.valor_total_compras)` | receita média **por cliente**, diluída pelos leads | — |
| `Avg(Venda.total)` | — | ticket médio **por venda**, que é o que o nome promete |

É pré-existente e independente do B10, mas a correção mexe nessa exata linha. Decidir se o KPI muda de significado junto — e, se mudar, que o rótulo mude com ele, porque o número vai saltar de 45 para 450 sem que nada tenha sido vendido.

---

## 7. Como medir no banco de staging

As contagens que faltam para dimensionar a correção, e que só o banco real responde:

```sql
-- Nomes de tabela conferidos no ORM: Venda usa db_table = "vendas"
-- (NAO "synapse_vendas_venda"); Cliente e InteracaoCliente usam o padrao.

-- 1. Quantos clientes tem Venda e agregado zerado (o universo do bug)
SELECT COUNT(DISTINCT v.cliente_id)
FROM vendas v
JOIN synapse_clientes_cliente c ON c.id = v.cliente_id
WHERE v.cliente_id IS NOT NULL AND c.valor_total_compras = 0;

-- 2. Quanto dinheiro esta invisivel
SELECT COALESCE(SUM(v.total), 0)
FROM vendas v
JOIN synapse_clientes_cliente c ON c.id = v.cliente_id
WHERE v.cliente_id IS NOT NULL
  AND c.valor_total_compras = 0
  AND v.status_pagamento <> 'cancelado';

-- 3. As migradas por status convertido (a armadilha da secao 4)
SELECT i.status_pagamento AS status_original, v.status_pagamento AS status_venda,
       COUNT(*), COALESCE(SUM(v.total), 0)
FROM synapse_clientes_interacaocliente i
JOIN vendas v ON v.id = i.migrada_para_venda_id
WHERE i.tipo = 'venda'
GROUP BY 1, 2;

-- 4. Quantas vendas tem data suspeita de B9 (gravadas no dia seguinte)
--    Heuristica: data_venda > a data de criacao convertida para Sao Paulo.
--    Nao pega as migradas: a data_venda delas vem de localtime() e esta certa.
SELECT COUNT(*)
FROM vendas
WHERE data_venda > (criado_em AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date;
```

A query 4 é a que diz se o B9 já sujou dado real ou se só está armado. **Ela deve rodar antes de qualquer correção**, porque depois de corrigir o `hoje()` a evidência para de ser produzida — mas as vendas já gravadas erradas continuam erradas, e aí é retro-população também.

---

## 8. O que esta branch não fez

Nada de código. `git diff master -- backend/ frontend/` está vazio.

As três sondas (`test_zz_sonda_metricas.py`, `test_zz_sonda_fuso.py`, `test_zz_sonda_ticket.py`) foram criadas, medidas e **apagadas**; nenhuma ficou no repositório, como nas auditorias anteriores.

### Resumo do que decidir antes de abrir a branch de correção

| # | Decisão | Quem decide |
|---|---|---|
| 1 | Signal em `Venda` **vs** `annotate`, **vs** coluna + teste de contrato | técnica |
| 2 | **B9 antes ou junto** do B10 — corrigir o B10 sozinho cria erro de fechamento de mês | técnica, mas com efeito de produto |
| 3 | Autoridade sobre os status convertidos das 22 (`nao_se_aplica` e `cancelado` → `pendente`) | produto + técnica |
| 4 | Venda promove o Lead? Em qual evento, para qual status, e rebaixa? | **produto (fundador)** |
| 5 | Retro-população: comando idempotente, data migration, ou nenhuma | técnica (depende da #1) |
| 6 | `vincular_cliente` recalcula os dois clientes, ou o vínculo congela? | técnica |
| 7 | "Ticket médio" passa a ser por venda? Se sim, o rótulo muda | **produto (fundador)** |

---

*Diagnóstico por leitura de código, varredura de padrões e verificação em execução. As medições que sustentam as afirmações — os agregados antes e depois de criar e confirmar uma Venda, o lookup `__month` no fuso de São Paulo, a dupla contagem do cliente migrado, a diluição do ticket médio e a divergência entre `date.today()` e `timezone.localdate()` — foram obtidas **rodando o código**, com sondas temporárias criadas, medidas e removidas. **Nenhuma linha de código de produção foi alterada nesta branch.** O único artefato é este documento.*

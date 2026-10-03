# 🩺 Auditoria de Saúde do Código — Synapse

**Data:** 2026-10-03
**Base:** `master` @ `eb49fa3` **+ PR #54** (`feature/agenda-vinculos` @ `064656a`, aberta)
**Escopo:** saúde estrutural — duplicação, arquitetura, código morto, proteção contra erro, testes, contrato e preparo para crescimento.
**Natureza desta branch:** auditoria. **Nenhuma linha de código de produção foi alterada.** O único artefato é este documento.
**Método:** leitura de código, varredura de padrões e **verificação em execução** onde dava para medir em vez de supor — contagem real de queries, formatação de datas rodada em Node no fuso de São Paulo, sondas de teste descartáveis (criadas, medidas e apagadas).

> **Nota de baseline — duas correções ao enunciado.**
>
> 1. A instrução dizia "agenda completa mergeada". O `master` tem as **categorias** (PR #53) mergeadas, mas a **PR #54** (vínculo com projeto e venda) estava **aberta** quando esta auditoria começou. A pedido, o escopo passou a cobrir os dois estados: os achados valem para o `master`, e onde a #54 muda o quadro está dito explicitamente.
> 2. Vários achados dos audits anteriores **foram de fato corrigidos** e estão confirmados resolvidos na seção 6. Mas dois que o `QUALITY_AUDIT` declarava contidos **não estavam**: o erro engolido (`UX-01`, "os únicos dois casos remanescentes") hoje são **30**, e as datas à mão (`INC-04`) passaram de 28 para **42 arquivos**. Ambos pioraram, não melhoraram.

---

## 1. Resumo Executivo

### Nota geral de saúde: **7,0 / 10**

Honesta, e a média esconde duas metades bem diferentes.

O que foi construído ou revisitado nos últimos meses é **sólido de verdade**: a arquitetura em camadas é respeitada com rigor incomum (um único módulo vaza ORM para a view, em 18), o multi-tenant é estrutural e não um `if` esquecido, há `select_for_update` em todos os pontos onde dinheiro e estoque podem competir, não existe um só TODO pendente, e as divisões por zero estão **todas** guardadas — item que eu esperava render achado e não rendeu.

O que puxa a nota para baixo não é desleixo: é **assimetria**. Os módulos recentes (vendas, agenda) têm 1,4 a 2,0 linhas de teste por linha de código; os antigos (recorrências, projetos) têm 0,30. Os fluxos tocados pelas últimas levas são atômicos; os gêmeos deles, escritos antes e copiados sem a transação, não são. O cuidado existe e é alto — ele só não foi aplicado uniformemente, e os buracos estão exatamente onde ninguém voltou.

Há **três bugs ativos** (não latentes: errados agora, em produção) e todos falham **em silêncio**, que é a categoria que o fundador pediu para priorizar.

| Severidade | Qtd |
|---|---|
| 🔴 risco real (bug latente, falha silenciosa, buraco de erro) | **9** |
| 🟠 dívida que atrapalha | **8** |
| 🟡 melhoria | **9** |
| 🔵 cosmético | **3** |
| **Total** | **29** |

### Os 5 mais importantes

1. **A tela da equipe mostra 1 tarefa aberta quando há 3.** Um filtro usa dois status que não existem no modelo (`"backlog"`, `"em_progresso"`). Medido em execução. Sem erro, sem aviso — só o número errado. `ERR-01` 🔴
2. **A invalidação de cache tem um fallback que "funciona" invalidando zero chaves.** O padrão não inclui o `KEY_PREFIX`, então não casa com nada no Redis, e a função retorna como se tivesse limpado. Provado em execução: a chave real é `synapse:1:synapse:7:...` e o padrão procura `synapse:7:...`. Quando o caminho principal falha, o sistema serve dado velho acreditando que invalidou. `ERR-02` 🔴
3. **Datas do backend aparecem um dia antes.** `formatDate("2026-10-05")` devolve `04/10/2026` no fuso de São Paulo — e `"2026-01-01"` devolve `31/12/2025`, ano errado. Atinge vencimento financeiro e follow-up no dashboard. Oito lugares já contornam à mão; o helper nunca foi consertado. `ERR-03` 🔴
4. **O dashboard transforma falha em zero.** Dezenove `except Exception` devolvem estruturas zeradas que a tela não distingue de zero real. Quem tem a consulta financeira quebrada lê "R$ 0,00 de receitas" e acredita. `ERR-04` 🔴
5. **`lancar_financeiro` faz duas escritas sem transação, e é justamente a guarda contra contar dinheiro duas vezes que isso derruba.** Se a segunda falhar, o lançamento existe e a venda não sabe — e a próxima tentativa lança de novo. `ERR-05` 🔴

### O que melhorou desde os audits anteriores — crédito devido

Isto não é formalidade: a maior parte do `QUALITY_AUDIT` foi **resolvida bem**, e em vários casos a correção foi melhor que a recomendada.

- ✅ **`QUEBRA-01` + `INC-01` (duas telas de lançamento divergentes)** — resolvido pela via difícil e certa: existe `components/financeiro/SecaoLancamentos.tsx`, consumido pelas **duas** rotas. Era a recomendação ("não fazer meia correção") e foi seguida à risca.
- ✅ **`QUEBRA-02` (texto branco invisível no tema claro)** — nenhum `text-white` resta nos inputs de `app/(auth)/`.
- ✅ **`QUEBRA-03` (mensagem de erro real descartada)** — `getErrorMessage` agora trata `Error` nativo **e** envelope, e o comentário no código explica por que a idempotência importa. A correção certa, não o remendo.
- ✅ **`COD-01` (o linter não rodava desde o Next 16)** — migrado para ESLint 9 com `eslint.config.mjs` e `"lint": "eslint ."`. Era o item que mais segurava reincidência.
- ✅ **`COD-02` + `INC-03` (`formatCurrency` frágil e com 5 cópias)** — consolidado. **Zero** cópias locais hoje; `lib/utils.ts` tem a versão robusta (aceita `string | number`), mais `formatCurrencyCompact` e `formatCurrencyOrNull`. E o docstring dela virou a melhor peça de filosofia do repositório: *"Converter ausência em zero é o tipo de silêncio que esconde defeito de dado."* (Guarde essa frase — o `ERR-04` a contradiz.)
- ✅ **Nenhum TODO/FIXME/HACK** em todo o código de produção. Confirmado.
- ✅ **Migrations saudáveis** — nenhum módulo acumulou lixo (máximo 11, em `auth`, que é o mais antigo). Nada a squashar.

Dois ficaram abertos: `INC-02` (gaveta mobile) e `UX-03` (placeholder), ambos registrados abaixo.

---

## 2. Achados por categoria

### 2.1 — Duplicação e redundância

---

#### DUP-01 — Datas formatadas à mão em 42 arquivos, e o helper está quebrado
- **Severidade:** 🟠 (a quebra do helper em si é o `ERR-03` 🔴)
- **Local:** 58 chamadas em 42 arquivos; só **6** usam `formatDate`/`formatDateTime` de `lib/utils`.
- **Descrição:** O `INC-04` do `QUALITY_AUDIT` contou 28 arquivos. Hoje são **42** — a dívida cresceu durante as correções. A PR #54 adiciona duas chamadas novas (`CompromissosVinculados.tsx:51` e o `rotuloDaVenda` em `useAgenda.ts:242`).

  O detalhe que muda o diagnóstico: **oito** desses lugares aplicam o contorno `+ "T00:00:00"`, e a #54 inventa um nono contorno diferente (`v.data_venda.split("-")` invertido à mão). Ou seja — isto não é só "o padrão é ignorado". É que **o helper canônico está errado para data pura** (`ERR-03`), cada autor descobriu isso sozinho, e cada um remendou do seu jeito. Padronizar nos helpers *antes* de consertá-los espalharia o bug para os 42.
- **Correção recomendada:** Na ordem. **(1)** consertar `formatDate` para data pura (`ERR-03`); **(2)** ampliar os helpers com as variantes realmente usadas (curta `dd/MM`, longa, com hora); **(3)** só então migrar os 42 — e aí os oito contornos podem cair junto, porque deixam de ser necessários.
- **Esforço:** Médio (mecânico, mas espalhado — e inútil se feito fora de ordem).

---

#### DUP-02 — O mesmo fluxo "apagar com ajustes" escrito três vezes, e só uma é atômica
- **Severidade:** 🟠 (a falta de transação é o `ERR-06` 🔴)
- **Local:** `vendas/services.py:573` · `clientes/services.py:165` · `fornecedores/services.py:200`
- **Descrição:** Três funções com a mesma assinatura (`estornar_estoque=False, apagar_financeiro=False`), a mesma ordem documentada (estoque → financeiro → apagar) e o mesmo resumo de retorno. A de vendas está dentro de `transaction.atomic()`; as outras duas **não têm uma única** ocorrência de `atomic` no arquivo.

  É o retrato do problema estrutural desta base: o padrão foi acertado uma vez e replicado sem a parte que o tornava seguro.
- **Correção recomendada:** Extrair o esqueleto comum (um helper que receba os dois callbacks de ajuste e a função de exclusão, e envolva tudo em `atomic`). Resolve a duplicação e o `ERR-06` no mesmo movimento — e impede que o quarto módulo a copiar o padrão erre de novo.
- **Esforço:** Médio.

---

#### DUP-03 — Hooks de fetch copiados com variações, incluindo no tratamento de erro
- **Severidade:** 🟠
- **Local:** `hooks/` (22 arquivos). Contraste direto: `useEstoque.ts` vs `useCategoriasAgenda.ts`.
- **Descrição:** Todo hook de listagem repete o mesmo bloco: `setLoading(true)` → `try` → `api.get` → `setX(resp.data)` → `catch` → `setError` → `finally setLoading(false)`. A estrutura é idêntica; o que **varia** é o que importa:

  | | captura o erro? | repropaga? | o caller consegue a mensagem real? |
  |---|---|---|---|
  | `useCategoriasAgenda.ts` | sim (`catch (err)`) | **sim** (`throw err`) | ✅ |
  | `useEstoque.ts` (7 pontos) | **não** (`} catch {`) | não | ❌ nunca |
  | `useClientes.ts` (5 pontos) | **não** | não | ❌ nunca |

  O mesmo padrão, com a decisão mais consequente tomada de forma diferente em cada cópia. Ver `ERR-07`.
- **Correção recomendada:** Um `useRecurso<T>(endpoint, params)` que encapsule loading/erro/repropagação **uma vez**. A PR #54 já faz isso em escala menor e por um motivo explícito — criou `useBuscaVinculo` em vez de copiar o bloco de debounce do cliente pela terceira vez, com o comentário dizendo que copiar era como o bug morto voltaria. O mesmo raciocínio se aplica aqui, num alvo maior.
- **Esforço:** Alto (22 hooks), mas fatiável por módulo.

---

#### DUP-04 — Lógica de negócio espelhada entre backend e frontend sem vínculo
- **Severidade:** 🟡
- **Local:** `types/agenda.ts` (`LEMBRETES`, `CORES_EVENTO`) ↔ `agenda/models.py` (`LEMBRETE_CHOICES`, `COR_PADRAO`); `hooks/useModulos.ts` (`MODULOS_OBRIGATORIOS`) ↔ `shared/modulos.py`.
- **Descrição:** Listas de domínio duplicadas nas duas pontas. O código é **honesto** sobre isso — `types/agenda.ts:82` diz *"Espelha LEMBRETE_CHOICES do backend — se mudar lá, muda aqui"* — e a honestidade é melhor que o silêncio, mas o comentário não é verificável por máquina: nada falha se os dois divergirem.
- **Correção recomendada:** Como são poucas listas e mudam raramente, gerar código seria exagero. O barato que fecha o buraco: um teste de contrato que bata a lista do front contra um endpoint de metadados (ou contra um JSON versionado gerado pelo backend). Falha no CI em vez de divergir calado.
- **Esforço:** Baixo.

---

### 2.2 — Organização e arquitetura

---

#### ARQ-01 — `search` é o único módulo sem camadas, com 10 pontos de ORM na view
- **Severidade:** 🟠
- **Local:** `modules/search/views.py` (todo o módulo: só `views.py` + `urls.py`)
- **Descrição:** Em 18 módulos, 17 têm `models`/`services`/`serializers`; 15 têm `repository`. O `search` tem **nenhum** — a view monta as queries direto, em 10 lugares.

  Em defesa dele: o `QUALITY_AUDIT` elogiou este módulo, e com razão — o gating por módulo está na camada certa e o cache inclui um fingerprint dos módulos ativos, o que é mais cuidadoso que a média. A lógica está **boa**; está só no arquivo errado.
- **Correção recomendada:** Extrair `services.py` + `repository.py` movendo as queries sem reescrevê-las. A nota de teste do módulo (0,96 de razão teste/código) dá cobertura para fazer isso com segurança.
- **Esforço:** Médio.

---

#### ARQ-02 — Vazamento de ORM para dentro dos services em 9 módulos que têm repository
- **Severidade:** 🟡
- **Local:** `painel_admin` (7 ocorrências de `.objects.`), `clientes` (4), `recorrencias` (3), `financeiro`/`fornecedores`/`notificacoes`/`vendas` (2 cada), `equipe`/`estoque` (1 cada).
- **Descrição:** 24 pontos onde o service fala com o ORM apesar de existir um repository ao lado. Nenhum é grave isoladamente; somados, são a erosão do limite que o resto da base respeita.
- **Correção recomendada:** Mover para o repository conforme cada arquivo for tocado por outro motivo. Não vale uma leva própria.
- **Esforço:** Baixo por ponto.

---

#### ARQ-03 — `ai_hub` e `auth` não têm repository
- **Severidade:** 🟡
- **Local:** `modules/ai_hub/`, `modules/auth/`
- **Descrição:** Os dois conversam com o ORM pelo service. Em `auth` é defensável (o `CustomUserManager` do Django já é a camada de acesso); em `ai_hub` é só ausência.
- **Correção recomendada:** `ai_hub` ganha repository quando for mexido. `auth` pode ficar — documentar a exceção evita que alguém "corrija" por simetria.
- **Esforço:** Baixo.

---

#### ARQ-04 — Verbos divergentes para a mesma operação
- **Severidade:** 🔵
- **Local:** transversal.
- **Descrição:** Criação: `criar` (21), `registrar` (6), `adicionar` (4). Remoção: `deletar` (30), `excluir` (5), `remover` (2), `apagar` (2). Em alguns casos a diferença é **semântica real** e boa (`registrar_movimentacao` registra um fato imutável; `apagar_interacao_com_ajustes` apaga com efeitos colaterais) — mas em outros é só autor diferente no dia diferente.
- **Correção recomendada:** Fixar `criar`/`deletar` como padrão e reservar os outros verbos para quando carregarem significado distinto. Renomear só o que for tocado — renomeação em massa é churn sem ganho.
- **Esforço:** Baixo.

---

#### ARQ-05 — Tamanho de arquivo sob controle
- **Severidade:** 🔵 (registro, não problema)
- **Descrição:** O maior arquivo de produção tem **699 linhas** (`clientes/[id]/page.tsx`); o maior do backend, 624 (`dashboard/services.py`). Para 104 mil linhas, nenhum arquivo-monstro. Não há nada a quebrar aqui — o item fica registrado para a resposta ser "verificado e está bem", não "não olhei".

---

### 2.3 — Código morto e dívida

---

#### MORTO-01 — `infoDoModo` é a única função verdadeiramente órfã
- **Severidade:** 🟡
- **Local:** `frontend/lib/preferencias.ts:112`
- **Descrição:** Exportada, zero chamadas em todo o repositório — inclusive dentro do próprio arquivo e dos testes. É a irmã do helper de `R$ NaN` com zero importadores que o audit anterior achou.

  Varri todos os exports de `lib/` à procura de mais: outros 7 nomes aparecem como "sem importador externo", mas **todos são usados dentro do próprio módulo** (`TITULO_MAX`, `PALETA_PADRAO`, `APP_VERSION`, …). Esses não são código morto — são `export` desnecessário, que é outra coisa e bem menor.
- **Correção recomendada:** Apagar `infoDoModo`. Tirar o `export` dos outros 7 (ou deixá-los: a varredura agora está documentada aqui, e o custo real é zero).
- **Esforço:** Trivial.

---

#### MORTO-02 — Três dependências do frontend instaladas e nunca importadas
- **Severidade:** 🟡
- **Local:** `frontend/package.json`
- **Descrição:** `@dnd-kit/sortable`, `@dnd-kit/utilities` e **`@tanstack/react-query`** — zero referências no código. A terceira é a interessante: react-query é uma biblioteca de cache/fetch, e o projeto resolveu o problema com hooks próprios (os 22 do `DUP-03`). Alguém começou pelo caminho da biblioteca e seguiu por outro, sem remover a dependência.
- **Correção recomendada:** Remover as três. Cada dependência instalada é superfície de CVE (o `SECURITY_AUDIT` já registrou três CVEs dev-only vindos de transitivas) e peso de `pnpm install` no CI.
- **Esforço:** Trivial.

---

#### MORTO-03 — `pillow` e `factory-boy` no `requirements.txt` sem uso; `django-filter` registrado e inerte
- **Severidade:** 🟡
- **Local:** `backend/requirements.txt`, `config/settings/base.py:42,165`
- **Descrição:** Verificado por nome de **import**, não de pacote (o heurístico por nome de pacote dá falso positivo em massa — `djangorestframework` importa como `rest_framework`):
  - `pillow` → nenhum `PIL`, e **nenhum `ImageField`** em modelo nenhum. Sem uso direto nem indireto.
  - `factory-boy` → nenhum `factory` nos testes (o `request_factory` do `conftest.py` é o `RequestFactory` do Django).
  - `django-filter` → está no `INSTALLED_APPS` **e** registrado como `DEFAULT_FILTER_BACKENDS`, mas **nenhuma view** declara `filterset_fields`/`filterset_class`/`filter_backends`. Carregado em toda requisição, usado em nenhuma.
- **Correção recomendada:** Remover `pillow` e `factory-boy`. Para `django-filter`, decidir: ou adotá-lo (os filtros hoje são `if` manuais nos services, ver `ARQ-02`) ou removê-lo do `INSTALLED_APPS` junto do pacote. Manter registrado sem usar é o pior dos três.
- **Esforço:** Trivial (a decisão do `django-filter` é que pede conversa).

---

### 2.4 — Proteção contra erro ⭐ *o item prioritário*

---

#### ERR-01 — A tela da equipe conta tarefas com dois status que não existem
- **Severidade:** 🔴 **bug ativo, falha silenciosa**
- **Local:** `backend/modules/equipe/models.py:63`
- **Descrição:** `MembroEquipe.total_tarefas_abertas` filtra:

  ```python
  status__in=["backlog", "a_fazer", "em_progresso"]
  ```

  `Tarefa.STATUS_CHOICES` (`projetos/models.py`) é: `a_fazer`, `em_andamento`, `revisao`, `concluido`.

  **`"backlog"` e `"em_progresso"` não existem.** Dos três valores do filtro, só um é válido — então a contagem ignora toda tarefa **em andamento** e toda **em revisão**.

  Medido em execução (sonda com 4 tarefas, uma por status, depois apagada):

  ```
  >>> tarefas abertas DE VERDADE (a_fazer+em_andamento+revisao): 3
  >>> o que a tela mostra (total_tarefas_abertas):               1
  ```

  Um `status__in` com valor inexistente não levanta erro — apenas não casa. O gestor abre a tela da equipe, lê "1 tarefa aberta" para quem tem 3, e não tem como desconfiar. A propriedade é serializada na **lista** de membros (`equipe/serializers.py:28,36`), então o erro está na visão principal do módulo.

  Varri o resto da base: `"backlog"` e `"em_progresso"` aparecem **exatamente nesta linha** e em nenhum outro lugar. É um achado isolado, não um padrão — o que o torna barato de corrigir e fácil de ter passado despercebido.
- **Correção recomendada:** Trocar por `.exclude(status="concluido")`, que sobrevive à adição de um status novo, em vez de uma lista literal que precisa ser lembrada. E **importar `STATUS_CHOICES`** em vez de repetir strings — um filtro por valor inexistente deveria ser impossível de escrever. Teste que fixe a contagem com uma tarefa de cada status.
- **Esforço:** Trivial (a correção). Baixo (com o teste e a tipagem dos status).

---

#### ERR-02 — O fallback de invalidação de cache invalida zero chaves e diz que funcionou
- **Severidade:** 🔴 **falha silenciosa**
- **Local:** `backend/shared/cache.py:72-86`
- **Descrição:** `invalidate_cache` tem três tentativas em cascata. A segunda monta o padrão à mão:

  ```python
  pattern = f"synapse:{empresa_id}:{modulo}:*"
  # ...
  keys = conn.keys(pattern)
  if keys:
      conn.delete(*keys)
      logger.info(...)
  return
  ```

  O comentário na linha 76 diz *"Padrão correto sem prefixo duplicado"*. É o contrário: o `CACHES` tem `KEY_PREFIX = "synapse"` (`base.py:211`), e o django-redis prefixa **e versiona** toda chave. Provado em execução:

  ```
  chave que o código monta : synapse:7:financeiro:resumo
  chave REAL no Redis      : synapse:1:synapse:7:financeiro:resumo
  o padrão casa com ela?   False
  ```

  Três consequências, em ordem de gravidade:
  1. `conn.keys()` devolve lista vazia → **nada é invalidado**;
  2. o `if keys:` não entra → **nada é logado** → silêncio completo;
  3. a função faz `return` → o chamador acredita que invalidou.

  O resultado é dado velho servido com confiança, até o TTL expirar (120s na agenda, 300s no padrão). Em produção o caminho 1 (`delete_pattern`) normalmente vence, então isto é **latente** — mas é o paraquedas reserva, e ele está dobrado errado.

  **Agravante no caminho 3:** o fallback final é `cache.clear()`, que apaga o cache de **todas as empresas**. O comentário diz "aceitável em testes com LocMemCache", mas nada impede o caminho em produção — e lá o raio de alcance é cross-tenant: a escrita de uma empresa derruba o cache de todas.
- **Correção recomendada:** Usar `cache.make_key(pattern)` para montar o padrão (em vez de montá-lo à mão), e trocar `conn.keys()` por **`conn.scan_iter()`** — `KEYS` é O(N) sobre o keyspace inteiro e **bloqueia o Redis**, o que é um problema de escala por si (ver `ESC-04`). Logar também o caso de **zero chaves**, que hoje é indistinguível de sucesso. E restringir o `cache.clear()` a quando o backend for `LocMemCache`, levantando em produção em vez de apagar o cache do vizinho.
- **Esforço:** Baixo.

---

#### ERR-03 — `formatDate` mostra o dia anterior para toda data pura do backend
- **Severidade:** 🔴 **bug ativo**
- **Local:** `frontend/lib/utils.ts:73-75`
- **Descrição:** O helper é `new Intl.DateTimeFormat("pt-BR").format(new Date(date))`. Para uma string ISO completa funciona. Para **data pura** — o que o DRF serializa de um `DateField`, `"2026-10-05"` — o `new Date` interpreta como **meia-noite UTC**, que em São Paulo (UTC−3) é 21h do dia **anterior**.

  Rodado em Node com `TZ=America/Sao_Paulo`:

  | Entrada | Saída | |
  |---|---|---|
  | `"2026-10-05"` | **`04/10/2026`** | ❌ um dia antes |
  | `"2026-01-01"` | **`31/12/2025`** | ❌ um dia **e um ano** antes |
  | `"2026-10-05T14:00:00Z"` | `05/10/2026` | ✅ |

  Há **26 `DateField`** nos modelos. Dois consumidores usam o helper direto sobre eles, e os dois estão errados agora:
  - `components/dashboard/VencimentosWidget.tsx:78` → `formatDate(v.data_vencimento)` — **vencimento financeiro um dia antes**;
  - `components/dashboard/FollowUpsWidget.tsx:91` → `formatDate(f.proximo_followup)` — follow-up um dia antes.

  Mais ~10 pontos fazem `new Date(campo).toLocaleDateString(...)` à mão e têm o mesmo defeito (`projetos` `data_prazo` em 4 lugares, `clientes` `proximo_followup` em 2, `fornecedores` `data_compra`/`ultima_compra`, `configuracoes` `plano_validade`).

  O que fecha o diagnóstico: **oito** lugares aplicam `+ "T00:00:00"` para escapar exatamente disto, e a PR #54 inventa um nono contorno (`split("-")` remontado à mão em `useAgenda.ts:242`). O bug é conhecido na prática e nunca foi corrigido na origem — cada um se defendeu sozinho.

  Um vencimento exibido um dia antes é erro com consequência: paga-se ou cobra-se na data errada.
- **Correção recomendada:** Ensinar os helpers a reconhecer data pura: se a string casa `^\d{4}-\d{2}-\d{2}$`, construir como **local** (`new Date(a, m-1, d)`) em vez de deixar o `Date` assumir UTC. Teste com `"2026-01-01"` fixando `01/01/2026` — é o caso que pega o erro de ano. Feito isso, os 8+1 contornos podem ser removidos, e só então vale migrar os 42 arquivos do `DUP-01`.
- **Esforço:** Baixo (o helper + teste). Médio (com a migração dos call sites).

---

#### ERR-04 — O dashboard converte falha em zero, e a tela não sabe a diferença
- **Severidade:** 🔴 **falha silenciosa**
- **Local:** `backend/modules/dashboard/services.py` (19 `except Exception`) e `views.py` (10)
- **Descrição:** Cada bloco do dashboard é embrulhado assim:

  ```python
  try:
      financeiro = FinanceiroService.obter_resumo(empresa_id, mes, ano)
  except Exception as e:
      logger.warning(f"Dashboard: erro ao obter resumo financeiro — {e}")
      financeiro = {"total_receitas": 0, "total_despesas": 0, "saldo": 0, ...}
  ```

  A intenção é boa e eu a reconheço: um widget quebrado não deve derrubar a tela inteira. O problema é o **valor escolhido para representar a falha**. A resposta não carrega sinal nenhum de degradação — procurei por qualquer marca (`erro`, `parcial`, `degradado`) e não há. Para o frontend, `total_receitas: 0` por falha é idêntico a `total_receitas: 0` por não ter havido receita.

  O resultado é a pior forma de erro: o usuário lê um número errado **com a mesma confiança** de um número certo, na primeira tela depois do login. Ninguém abre o log do servidor para conferir o dashboard.

  E há uma contradição interna que vale citar, porque o projeto **já escreveu a regra certa** — o docstring de `formatCurrency`, adotado na correção do `COD-02`:

  > *"Zero de verdade é informação. Valor que se perdeu no caminho é outra coisa, e sai como '—' — quem olha percebe a falta em vez de ler um zero que nunca existiu. Converter ausência em zero é o tipo de silêncio que esconde defeito de dado."*

  O dashboard faz exatamente o que esse parágrafo proíbe.
- **Correção recomendada:** Manter a resiliência e **marcar a degradação**: devolver o bloco como `None` (ou com `"indisponivel": True`) e a tela mostrar "não foi possível carregar" naquele cartão. O `formatCurrency` já sabe transformar ausência em `"—"` — a infraestrutura para fazer isso bem **já existe**, só não está sendo usada aqui. Vale também estreitar os `except Exception` para as exceções que de fato se espera (banco fora, timeout), para um `AttributeError` de refatoração não virar um zero plausível.
- **Esforço:** Médio (29 pontos, mas repetitivos) — e o maior ganho de confiabilidade percebida de toda a lista.

---

#### ERR-05 — `lancar_financeiro`: duas escritas sem transação derrubam a guarda contra dinheiro duplicado
- **Severidade:** 🔴
- **Local:** `backend/modules/vendas/services.py:236-285`
- **Descrição:** A função escreve em dois lugares, sem `transaction.atomic()`:

  ```python
  lancamento = FinanceiroService.criar_lancamento(...)   # escrita 1
  venda.lancamento_financeiro = lancamento
  venda.save(update_fields=[...])                        # escrita 2
  ```

  E ela abre justamente com a guarda de idempotência:

  ```python
  if venda.lancamento_financeiro_id:
      raise BusinessRuleViolation(code="VENDA_JA_COM_LANCAMENTO", ...)
  ```

  cujo docstring explica o risco: *"Um segundo lançamento contaria o mesmo dinheiro duas vezes."*

  A guarda depende do vínculo da escrita 2. Se a 1 passar e a 2 falhar — conexão caindo, timeout, deploy no meio — fica um lançamento de receita no financeiro que a venda **não conhece**. A guarda não dispara na próxima tentativa, o usuário clica de novo, e **o mesmo dinheiro é lançado duas vezes**. É o cenário exato que o comentário diz estar protegido.

  O contraste está no mesmo arquivo: `baixar_estoque` (:188) **é** atômica, com um comentário dizendo por que (*"ou todas as saídas acontecem, ou nenhuma: uma venda meio baixada é pior do que uma não baixada"*). O raciocínio foi feito para o estoque e não repetido para o dinheiro, que é o lado mais sensível.
- **Correção recomendada:** `with transaction.atomic():` em volta das duas escritas. Uma linha. Teste que simule falha na segunda escrita e afirme que nenhum lançamento sobrou.
- **Esforço:** Trivial (a correção). Baixo (com o teste).

---

#### ERR-06 — Dois fluxos de "apagar com ajustes" sem atomicidade, com estorno de estoque dentro
- **Severidade:** 🔴
- **Local:** `backend/modules/clientes/services.py:165-199` · `backend/modules/fornecedores/services.py:200-237`
- **Descrição:** A face de risco do `DUP-02`. Os dois fazem **três** escritas em sequência — estornar movimentação de estoque, ajustar/apagar lançamento financeiro, apagar o registro — e `grep -c "transaction.atomic"` nos dois arquivos devolve **0**.

  Falha no meio deixa estados impossíveis de reconciliar à mão:
  - estorno feito, exclusão falhou → **estoque somado de volta com a venda ainda existindo**, e repetir a operação estorna de novo, **inflando o estoque**;
  - lançamento cancelado, exclusão falhou → receita cancelada para uma venda que continua lá.

  O estorno é a parte perigosa porque é **cumulativo**: a movimentação original é imutável por regra do módulo, então estornar é somar, e somar duas vezes não se desfaz sozinho.
- **Correção recomendada:** Envolver os dois em `transaction.atomic()`. Preferencialmente pelo helper comum do `DUP-02`, para o próximo módulo herdar a transação em vez de ter de lembrar dela.
- **Esforço:** Baixo (dois `with`). Médio (com a unificação).

---

#### ERR-07 — 30 `catch` que descartam o erro antes de ele chegar ao usuário
- **Severidade:** 🔴
- **Local:** `hooks/useEstoque.ts` (7) · `hooks/useClientes.ts` (5) · `hooks/useAuth.ts` (3) · `lib/api.ts` (2) · mais 13 espalhados. A PR #54 adiciona o 30º.
- **Descrição:** O `QUALITY_AUDIT` registrou isto como `UX-01` e disse: *"São os únicos dois casos remanescentes no sistema — a varredura não encontrou outros."* A varredura olhou `components/`. Nos **hooks** há 28 mais.

  O padrão:

  ```ts
  } catch {
    setError("Erro ao carregar produtos.");
  }
  ```

  O `} catch {` sem binding **não tem como** usar o erro: a mensagem real do backend é descartada na sintaxe. E como o hook não repropaga, o caller também não a alcança. O trabalho que o backend faz para devolver `"Produto sem estoque suficiente"` ou `"Categoria já existe"` morre aqui, e o usuário lê "Erro ao carregar".

  Isso é mais grave agora do que era antes do audit anterior, porque `getErrorMessage` **foi corrigido** (`QUEBRA-03`) e hoje funciona bem — a infraestrutura está pronta e 30 lugares não a usam.

  **Nem todos são defeito.** Pelo menos três são escolhas legítimas e devem ficar: os dois de `lib/api.ts` (converter falha de rede e corpo não-JSON em envelope — fazem isso explicitamente e bem), o de `chatHistory.ts` (leitura de `localStorage`), e o de `UsuariosSection.tsx:196` (falha de clipboard, onde não há mensagem de backend). A PR #54 também documenta o dela como deliberado, com justificativa. O alvo são os ~25 em hooks de dados.
- **Correção recomendada:** `catch (err)` + `setError(getErrorMessage(err))` + `throw err`. Mecânico. E uma **guarda por varredura** que falhe se um `} catch {` reaparecer em `hooks/` fora de uma allowlist — o repositório já tem o precedente (`app/(dashboard)/no-native-confirm.test.ts` e `components/agenda/sem-pintura-por-cor-crua.test.ts`). Sem a guarda, o padrão volta: ele já voltou uma vez, depois de declarado resolvido.
- **Esforço:** Médio (25 pontos). Baixo para a guarda.

---

#### ERR-08 — O contrato da API é asserção, não verificação
- **Severidade:** 🟠
- **Local:** `frontend/lib/api.ts:183` (`return data as ApiResponse<T>`)
- **Descrição:** O cliente HTTP é **bem construído** — e vale dizer antes da crítica: converte falha de rede em envelope com mensagem em português, distingue 5xx-sem-JSON de erro de validação, trata 204, e faz refresh de 401 com fila para não disparar N refreshes simultâneos. É uma das melhores peças do frontend.

  O ponto cego é a última linha: `data as ApiResponse<T>`. O `T` vem de quem chamou, nada confere a forma real, e um cast não valida nada em runtime. Se o backend mudar um campo, o TypeScript continua dizendo que está tudo certo e o erro aparece como `undefined` três telas adiante.

  É a versão estrutural do `COD-02` (o `formatCurrency` que "mentia no tipo"): ali o tipo dizia `number` e vinha `string`. A correção consertou **aquele** ponto; a fronteira que deixa isso acontecer continua igual.

  Sintoma mensurável: **16 `as unknown as`** no código (14 no master, +2 na #54), concentrados nos hooks — e, pelos tipos, quase todos são **redundantes**: `api.get<Evento[]>()` já devolve `ApiResponse<Evento[]>`, cujo `.data` **já é** `Evento[]`. O cast duplo não resolve problema de tipo nenhum; ele registra que o autor não confiou no que o tipo dizia. Dado o `return data as ApiResponse<T>`, a desconfiança está certa.
- **Correção recomendada:** Validar na fronteira. Como o projeto já usa **Zod** (`@hookform/resolvers/zod` nos formulários), o custo marginal é baixo: `api.get(endpoint, { schema })` que faça `schema.parse` e falhe alto, com mensagem clara, em vez de deixar o `undefined` vazar. Adotar de forma incremental, começando pelos endpoints de dinheiro. Os 16 `as unknown as` caem junto.
- **Esforço:** Alto (incremental, endpoint a endpoint).

---

#### ERR-09 — `INC-02`: a gaveta do mobile continua abrindo sozinha
- **Severidade:** 🟡 *(reaberto — não corrigido)*
- **Local:** `frontend/store/useAppStore.ts:54` · `components/layout/Sidebar.tsx:96`
- **Descrição:** Confirmado idêntico ao que o audit anterior descreveu, e não corrigido. `sidebarOpen: true` no default; `Sidebar.tsx:96` renderiza o overlay preto (`fixed inset-0 z-30 bg-black/60 md:hidden`) sempre que `sidebarOpen` é verdadeiro. No celular, **todo** carregamento começa com a tela coberta.

  Um booleano com dois significados opostos: no desktop `true` = "expandida" (o default desejado); no mobile `true` = "gaveta aberta sobre o conteúdo" (nunca desejado na carga).
- **Correção recomendada:** Como o audit anterior propôs — separar `sidebarExpandida` (desktop, default `true`) de `gavetaAberta` (mobile, default `false`). Agora há um recurso que não existia antes: `hooks/useTelaEstreita.ts` (criado na Fase B1 da agenda, com `useSyncExternalStore` para não divergir na hidratação). Ele resolve a inicialização por breakpoint sem o risco de hidratação que teria travado a correção antes.
- **Esforço:** Baixo.

---

### 2.5 — Testes

---

#### TST-01 — Cobertura de backend varia 6,7× entre módulos, e o buraco está nos antigos
- **Severidade:** 🟠
- **Descrição:** Razão linhas-de-teste / linhas-de-código por módulo:

  | Módulo | Razão | | Módulo | Razão |
  |---|---|---|---|---|
  | **vendas** | 2,02 | | notificacoes | 0,50 |
  | **agenda** | 1,41 | | equipe | 0,47 |
  | search | 0,96 | | fornecedores | 0,47 |
  | financeiro | 0,73 | | estoque | 0,45 |
  | clientes | 0,66 | | ai_hub | 0,43 |
  | caixinhas | 0,55 | | painel_admin | 0,42 |
  | documentos | 0,52 | | auth | **0,39** |
  | | | | projetos | **0,36** |
  | | | | **recorrencias** | **0,30** |

  A correlação com o histórico é direta: o que foi trabalhado recentemente está no topo. O risco concentra-se embaixo — e **`auth` com 0,39** é o que mais incomoda, por ser a porta de entrada e ter regras de segurança (rate limit, reset de senha, suspensão de empresa) que o `SECURITY_AUDIT` tratou como críticas.

  `equipe` (0,47) é onde o `ERR-01` viveu sem ser notado — evidência de que o número não é abstrato.
- **Correção recomendada:** Não perseguir cobertura uniforme. Escolher por risco: `auth` (fluxos de segurança), `equipe` (contagens da tela, onde o bug mora), `recorrencias` (gera lançamento financeiro automático — erro ali vira dinheiro errado sem ninguém pedir).
- **Esforço:** Alto, fatiável por módulo.

---

#### TST-02 — Assimetria frontend: módulos inteiros sem um único teste
- **Severidade:** 🟠
- **Descrição:** Componentes por pasta × pastas com teste:

  | Pasta | Componentes | Com teste | |
  |---|---|---|---|
  | **dashboard** | 13 | **1** | ⚠️ a primeira tela depois do login |
  | ui | 13 | 2 | base compartilhada por tudo |
  | fornecedores | 10 | 2 | |
  | estoque | 9 | 2 | |
  | **projetos** | 6 | **0** | |
  | **ai_hub** | 6 | **0** | |
  | **equipe** | 5 | **0** | |
  | documentos | 2 | 0 | |
  | notificacoes | 1 | 0 | |
  | clientes | 14 | 12 | ✅ |
  | agenda | 5 | 7 | ✅ mais testes que componentes |

  O cruzamento que importa: **`dashboard` tem 13 componentes e 1 teste — e é o dono do `ERR-04`**, a falha que mostra zero sem avisar. A tela que menos pode errar calada é a menos testada. Mesmo para `equipe`: 0 testes de frontend, e o `ERR-01` é um número errado na tela dela.
- **Correção recomendada:** Começar por `dashboard` e `ui` — o primeiro pelo risco, o segundo porque um defeito na base compartilhada se espalha por todas as telas.
- **Esforço:** Alto, fatiável.

---

#### TST-03 — Nove testes mockam `@/lib/api` com um único método
- **Severidade:** 🟡
- **Local:** `ExpedienteSection.test.tsx`, `IdentidadeVisualSection.test.tsx`, `Landing.test.tsx`, `PlanosSection*.test.tsx`, `ExcluirEmpresaModal.test.tsx`, `PreferenciasSection.test.tsx`, `ModulosSection.test.tsx`, `PlanosPrecosSection.test.tsx`
- **Descrição:** Mockam o módulo `api` inteiro declarando só `get` (ou só `post`). Se o componente chamar outro método, o mock devolve `undefined`, o componente entra no caminho de erro, e o teste **pode continuar passando pelo motivo errado** — afirmando um estado que só existe porque a API está quebrada no mock.

  Não é hipótese: este exato defeito já foi encontrado e corrigido nesta base durante a Leva 2 da agenda — dois testes de estoque afirmavam sincronamente algo que só valia porque o mock de `api` não tinha `get`. A família de 9 permanece.
- **Correção recomendada:** Um helper de mock compartilhado que declare **todos** os métodos, com default que **falhe alto** (`throw new Error("api.X não esperado neste teste")`) em vez de devolver `undefined`. Assim uma chamada não prevista quebra o teste em vez de passar calada.
- **Esforço:** Baixo (o helper) + baixo por teste.

---

#### TST-04 — Fluxos críticos de ponta a ponta: bem cobertos, com uma exceção
- **Severidade:** 🟡 (em boa parte, crédito)
- **Descrição:** Conferido um a um, porque a spec pede nominalmente:
  - venda completa → `test_vendas.py` + `test_vendas_integracoes.py` ✅
  - fiado → `test_vendas_fiado.py` ✅
  - estorno → coberto em `test_vendas_integracoes.py` ✅
  - migração → `test_migrar_vendas.py` ✅
  - multi-tenant → presente em **todas** as suítes, como seção própria ✅
  - **recorrências → `0,30` de razão**, e é o fluxo que **cria lançamento financeiro sozinho**, sem ninguém clicar. ⚠️

  O único furo real na lista é o último, e é o mais incômodo: automação que mexe em dinheiro é onde um erro passa mais tempo sem ser visto.
- **Correção recomendada:** Teste de ponta a ponta de recorrência: gerar ocorrência → confirmar → lançamento criado com valor/data certos → não gerar duplicata na segunda execução (idempotência).
- **Esforço:** Médio.

---

### 2.6 — Consistência de contrato

---

#### CTR-01 — `decimal` como string: o tipo agora é honesto, o hábito do cast ficou
- **Severidade:** 🟡
- **Descrição:** A divergência que o `COD-02` apontou **foi corrigida** — `formatCurrency(valor: unknown)` aceita os dois, e `types/vendas.ts` declara `subtotal: string`, `total: string`, o que **corresponde** ao que o DRF manda. Crédito.

  O que sobrou é o resíduo: os 16 `as unknown as` do `ERR-08` e 9 `: any`/`as any`. Nenhum é quebra ativa; todos são lugares onde o compilador foi calado em vez de convencido.
- **Correção recomendada:** Junto do `ERR-08`.
- **Esforço:** Baixo isoladamente.

---

#### CTR-02 — O envelope da API é consistente; o acesso a ele, não
- **Severidade:** 🟡
- **Descrição:** O backend é **uniforme**: `shared/responses.py` centraliza `success_response`/`created_response`/`error_response`/`no_content_response`, e o formato `{success, data, message, pagination?}` vale em todos os módulos. O bug histórico de `res.data` vs `res.data.data` não tem como voltar pelo backend.

  No frontend o acesso varia sem motivo: `res.data || []`, `resp.data ?? []`, `(resp.data as unknown as T[]) ?? []`. Mesmo dado, três escritas. Sintoma do `DUP-03` e do `ERR-08`.
- **Correção recomendada:** Resolve-se de graça com o `useRecurso` do `DUP-03`.
- **Esforço:** Incluído no `DUP-03`.

---

#### CTR-03 — Tratamento de erro da API: padronizado no backend, irregular no consumo
- **Severidade:** 🟡
- **Descrição:** O backend tem `shared/exceptions.py` (`BusinessRuleViolation` com `code`/`message`/`details`, `ResourceNotFound`) e um handler que devolve tudo no mesmo envelope — bem feito. `getErrorMessage` e `getFieldErrors` no front sabem lê-lo.

  O que falha é o meio do caminho: os 30 `catch` do `ERR-07` jogam fora o envelope antes de alguém lê-lo. O contrato existe nas duas pontas e é rompido no transporte.
- **Correção recomendada:** É o `ERR-07`.
- **Esforço:** Ver `ERR-07`.

---

### 2.7 — Escalabilidade

---

#### ESC-01 — A lista de projetos faz 42 queries para 10 projetos, e o `prefetch` é pago e ignorado
- **Severidade:** 🔴
- **Local:** `backend/modules/projetos/models.py:83,88` + `repository.py:22-28`
- **Descrição:** `ProjetoRepository.listar_projetos` faz `.prefetch_related("tarefas")` — intenção clara de evitar N+1. Mas as propriedades serializadas na lista fazem:

  ```python
  self.tarefas.filter(status__in=[...]).count()   # total_tarefas
  self.tarefas.filter(status="concluido").count() # tarefas_concluidas
  ```

  `.count()` e `.filter()` sobre um manager relacionado **não usam o cache do prefetch** — emitem SQL novo. Então o prefetch carrega todas as tarefas, ninguém as lê, e as queries acontecem de todo jeito.

  Medido em execução (10 projetos × 3 tarefas, sonda depois apagada):

  ```
  >>> 10 projetos serializados em 42 queries
  ```

  **4,2 queries por projeto.** Em 100 projetos, ~420 queries numa abertura de tela. É o retrato do item "funciona com 1 empresa, quebra com 100".
- **Correção recomendada:** Trocar as propriedades por `annotate` no repository (`Count("tarefas")` e `Count("tarefas", filter=Q(status="concluido"))`) — vira **uma** query no total. O serializer já declara os três campos como `IntegerField(read_only=True)`, então **nada no frontend muda**. Remover o `prefetch_related`, que deixa de ter função. Travar com um teste de contagem de queries — o repositório já tem o precedente (`test_agenda_vinculos.py` usa `CaptureQueriesContext`).
- **Esforço:** Baixo. **Melhor relação ganho/esforço de toda a auditoria.**

---

#### ESC-02 — A lista de membros da equipe repete o padrão, três vezes por linha
- **Severidade:** 🟠
- **Local:** `backend/modules/equipe/models.py:57-85` + `serializers.py:28-50`
- **Descrição:** Mesma classe de problema do `ESC-01`. `MembroEquipe` serializa na lista três propriedades que consultam o banco uma a uma:
  - `total_tarefas_abertas` → 1 query (**e conta errado**, ver `ERR-01`)
  - `total_projetos` → 1 query
  - `progresso_meta_atual` → 1 query (com `order_by` + `first()`)

  Três queries por membro, sem `annotate` nem `prefetch`. Uma equipe de 30 pessoas = 90+ queries. Agrava que as duas primeiras consultam **outro módulo** (`projetos`), com import dentro da função — acoplamento que nenhum prefetch alcança de fora.
- **Correção recomendada:** Mover para `annotate` no repository de equipe, como no `ESC-01`. O `progresso_meta_atual` pede `Prefetch` com queryset filtrado (meta vigente). Corrigir junto com o `ERR-01`, que está na mesma linha: um `annotate` escrito a partir de `STATUS_CHOICES` mata os dois.
- **Esforço:** Médio.

---

#### ESC-03 — Cinco endpoints de listagem sem paginação
- **Severidade:** 🟡
- **Local:** `agenda/views.py:178` (categorias) · `documentos/views.py:105` (versões) · `equipe/views.py:172` (metas) · `financeiro/views.py:45` (categorias) · `fornecedores/views.py:62` (categorias)
- **Descrição:** Todas são listas **naturalmente curtas** — categorias por empresa, versões de um documento, metas de um membro. O risco hoje é baixo e eu não vou inflá-lo. Mas o teto é por **convenção, não por código**: nada impede uma empresa de criar 5.000 categorias, e aí a resposta cresce sem limite. A spec pedia nominalmente "lista sem teto", e este é o conjunto.
- **Correção recomendada:** Paginar por consistência (o `StandardPagination` já existe e é usado em todo o resto) ou impor um limite explícito na criação. O caso de `documentos/versoes` é o que mais cresce com o uso real.
- **Esforço:** Baixo.

---

#### ESC-04 — `conn.keys()` na invalidação bloqueia o Redis inteiro
- **Severidade:** 🟠 *(e 🔴 pelo lado funcional — ver `ERR-02`)*
- **Local:** `backend/shared/cache.py:77`
- **Descrição:** O lado de escala do `ERR-02`. O comando `KEYS` do Redis é **O(N) sobre o keyspace completo** e **single-threaded**: enquanto varre, nenhuma outra operação é atendida. Com 100 empresas e páginas cacheadas por combinação de filtros, o keyspace fica grande, e **toda escrita** (todo create/update que chama `invalidate_cache`) tentaria essa varredura.

  Hoje é latente porque o caminho 1 (`delete_pattern`, que usa SCAN internamente) normalmente vence. Mas o fallback é o que roda **justamente quando as coisas já vão mal** — e é aí que ele adiciona um bloqueio global.

  Somado ao `ERR-02`: o fallback bloqueia o Redis para procurar um padrão que não casa com nada.
- **Correção recomendada:** `scan_iter()` em vez de `keys()`. Corrigir junto com o `ERR-02`, mesma função, mesma leva.
- **Esforço:** Trivial.

---

#### ESC-05 — Processamento assíncrono bem endereçado
- **Severidade:** 🔵 (crédito, não achado)
- **Descrição:** Item que a spec pede e que não rendeu problema. O que deve ser assíncrono é: há Celery com `beat_schedule` em `config/celery.py`, e `tasks.py` em 8 módulos (lembretes de agenda, cobrança de fiado, vencimentos, metas de equipe, recorrências). As tarefas respeitam `empresa_id` e usam `empresas_com_modulo` para pular empresa que desligou o módulo. A varredura de lembretes tem índice próprio (`["lembrete_enviado", "data_inicio"]`) — índice pensado para o padrão de acesso da task, não para o da tela. É sinal de atenção real a escala.

---

## 3. Padrões recorrentes

Cinco achados isolados podem ser cinco correções. Estes **quatro padrões** são uma correção cada, e é assim que vale atacá-los.

### 1. O padrão foi acertado uma vez e copiado sem a parte que o protegia
O achado estrutural mais importante desta auditoria.

| Feito certo | Copiado sem a proteção |
|---|---|
| `baixar_estoque` é atômica, com comentário explicando por quê | `lancar_financeiro` não é (`ERR-05`) |
| `apagar_venda_com_ajustes` é atômica | as versões de `clientes` e `fornecedores` não são (`ERR-06`) |
| `useCategoriasAgenda` captura e repropaga o erro | `useEstoque`/`useClientes` descartam (`ERR-07`) |
| `agenda`/`vendas` com 1,4–2,0 de teste | `recorrencias`/`projetos` com 0,30–0,36 (`TST-01`) |

Não é falta de conhecimento — o conhecimento está no repositório, escrito e comentado. É que **nada propaga o padrão** para a cópia seguinte. Daí a recomendação recorrente de extrair o esqueleto comum (`DUP-02`, `DUP-03`): não pela elegância, mas porque **um esqueleto compartilhado carrega a proteção consigo** e o próximo módulo a herda sem precisar lembrar.

### 2. Falha convertida em valor plausível
`ERR-01` (status inexistente → conta 1 em vez de 3), `ERR-02` (invalida zero → diz que invalidou), `ERR-03` (data pura → dia anterior), `ERR-04` (exceção → zero).

Nenhum desses lança erro. Todos produzem um valor **que parece certo**. É a categoria mais cara de bug, porque não há como o usuário desconfiar, e o projeto **já tem a regra escrita** para combatê-la — o docstring de `formatCurrency`, que distingue "zero de verdade" de "valor que se perdeu". A regra existe num helper e não foi aplicada no dashboard, no cache nem no filtro da equipe.

**Correção sistemática:** adotar a distinção ausência ≠ zero como regra de projeto, não de função. Onde houver falha, propagar ausência (`None`, `—`, "indisponível"), nunca um número plausível.

### 3. Helper existe, está errado, e cada um contorna sozinho
O `QUALITY_AUDIT` diagnosticou "helper existe e é ignorado". O quadro é pior e mais interessante: em moeda, a cópia local era **melhor** que o canônico (por isso ninguém adotava) — e a correção promoveu a boa, o que resolveu de verdade. Em data, o canônico está **errado** para data pura (`ERR-03`), nove lugares contornaram de **três maneiras diferentes**, e ninguém corrigiu a origem.

**Correção sistemática:** quando um helper é ignorado em massa, a pergunta certa não é "por que não adotam?" e sim "**o que está errado nele?**". Em moeda essa pergunta foi feita e resolvida. Em data, não.

### 4. Propriedade de model que consulta o banco e é serializada em lista
`ESC-01` (projetos, medido: 4,2 queries/linha), `ESC-02` (equipe, 3 queries/linha), e `documentos/models.py:64` (`self.versoes.count()`).

O mesmo gesto — expor um agregado como `@property` do model — que é limpo numa tela de detalhe e quadrático numa listagem. Em projetos há até um `prefetch_related` que **não funciona** para `.count()`, o que mostra que o problema foi percebido e a solução aplicada não era a certa.

**Correção sistemática:** agregado que aparece em lista nasce como `annotate` no repository, não como `@property` no model. Travado por teste de contagem de queries, que o repositório já sabe escrever.

---

## 4. O que está bem — não mexer

Levantado com o mesmo rigor dos achados, porque saber onde **não** tocar vale tanto quanto a lista de problemas.

- ✅ **Arquitetura em camadas, respeitada de verdade.** 17 de 18 módulos têm `models`/`services`/`serializers`/`views`; 15 têm `repository`. ORM na view: **um** módulo (`search`). Para 104 mil linhas escritas por mãos diferentes em fases diferentes, é disciplina acima do normal.
- ✅ **Multi-tenant estrutural, não por `if`.** `EmpresaQuerySetMixin` + `IsEmpresaMember` aplicados em todas as views de dados, recorte por empresa **antes** de qualquer filtro nos repositories, e seção própria de teste multi-tenant em cada suíte. Não achei um caminho de vazamento entre empresas.
- ✅ **Concorrência protegida onde dói.** `select_for_update` em caixinhas (saldo), estoque (produto e variação), kanban (ordem) e fornecedores (score). Os quatro pontos onde duas pessoas clicando junto corromperiam dado têm lock pessimista dentro de transação.
- ✅ **Divisão por zero: guardada em todos os pontos.** `Projeto.progresso`, `Produto.margem_lucro`, `MetaEquipe.progresso_percentual`, `Fornecedor.media_avaliacoes` — os quatro checam antes de dividir. Item que eu esperava render achado e rendeu crédito.
- ✅ **Índices bem desenhados.** 14 de 15 módulos com modelo têm `models.Index` composto começando por `empresa`. `auth` não tem composto, mas tem `db_index` nas FKs e `unique` no e-mail, que cobre as rotas quentes (login, usuários da empresa). E há índice pensado para a **task** (`["lembrete_enviado", "data_inicio"]`), não só para a tela.
- ✅ **Idempotência onde o mundo externo entra.** Guardas em notificação de agenda (`lembrete_enviado`), cobrança de fiado (`notificacao_enviada`), e-mail de meta (`email_conclusao_enviado`) e migração de vendas. E-mail enviado duas vezes não se desfaz — estes pontos sabem disso.
- ✅ **Envelope de API uniforme.** `shared/responses.py` + `shared/exceptions.py` centralizam formato e códigos de erro. A inconsistência que sobra está no **consumo** (`ERR-07`), não na origem.
- ✅ **O cliente HTTP do frontend.** Falha de rede vira mensagem em português; 5xx-sem-JSON é distinguido de erro de validação; 204 tratado; refresh de 401 com fila, para N chamadas simultâneas não disparem N refreshes. Só falta validar a forma (`ERR-08`).
- ✅ **Zero TODO/FIXME/HACK** no código de produção. Confirmado por varredura.
- ✅ **Migrations limpas.** Máximo de 11 (`auth`, o módulo mais antigo); 7 módulos com 1–2. Nada órfão, nada a squashar.
- ✅ **Tamanho de arquivo sob controle.** Maior arquivo: 699 linhas.
- ✅ **Código morto quase inexistente.** Em todo `lib/`, **uma** função órfã (`infoDoModo`). Depois de um audit anterior que encontrou helper com zero importadores, isto indica limpeza ativa.
- ✅ **O hábito de teste-guarda por varredura.** `no-native-confirm.test.ts` e `sem-pintura-por-cor-crua.test.ts` fazem o código-fonte falhar quando um padrão ruim reaparece. É a ferramenta certa para a reincidência do `ERR-07`, e ela já está no repositório — basta apontá-la para o alvo novo.

---

## 5. Proposta de levas de correção

Ordenado por **risco × esforço**, não por categoria. As duas primeiras levas resolvem os três bugs ativos.

### Leva 1 — Os bugs ativos e o quase-grátis *(≈1 dia)*
Tudo aqui está errado **agora**, em produção, e a correção é pequena.

1. `ERR-01` — status inexistente na contagem da equipe (1 linha + teste)
2. `ERR-05` — `transaction.atomic` no `lancar_financeiro` (1 linha + teste)
3. `ERR-06` — `transaction.atomic` nos dois "apagar com ajustes" (2 linhas + testes)
4. `ERR-02` + `ESC-04` — `make_key` + `scan_iter` + logar zero chaves (mesma função)
5. `ESC-01` — `annotate` na lista de projetos: 42 queries → 1, sem mudar o frontend

> Fecha 5 achados, 3 deles 🔴, e entrega a maior melhoria de performance da lista. Se só uma leva for feita, é esta.

### Leva 2 — A data, na ordem certa *(≈1 dia + migração)*
6. `ERR-03` — consertar `formatDate`/`formatDateTime` para data pura, com teste em `"2026-01-01"`
7. Remover os 9 contornos `T00:00:00`/`split("-")`, que deixam de ser necessários
8. `DUP-01` — só então migrar os 42 arquivos (mecânico, fatiável, pode ir em segundo plano)

> A ordem é o ponto. Migrar para o helper **antes** de consertá-lo espalharia o bug para 42 arquivos.

### Leva 3 — Parar a falha silenciosa *(≈2–3 dias)*
9. `ERR-04` — dashboard marca degradação em vez de devolver zero; a tela mostra "indisponível"
10. `TST-02` (parcial) — testes de `dashboard`, que é a tela do `ERR-04` e tem 1 teste para 13 componentes

> Maior ganho de confiança percebida. O usuário deixa de ler número errado com cara de certo.

### Leva 4 — O erro chega ao usuário, e fica *(≈2 dias)*
11. `ERR-07` — os ~25 `catch` de hooks: `catch (err)` + `getErrorMessage` + `throw`
12. Teste-guarda por varredura contra `} catch {` em `hooks/`, com allowlist para os legítimos

> O item 12 é o que importa a longo prazo: sem ele o padrão volta — **já voltou uma vez**, depois de declarado resolvido.

### Leva 5 — Faxina *(≈meio dia)*
13. `MORTO-02` + `MORTO-03` — remover 5 dependências sem uso; decidir o `django-filter`
14. `MORTO-01` — apagar `infoDoModo`
15. `ERR-09` — gaveta mobile, agora com `useTelaEstreita` disponível
16. `UX-03` — o `placeholder-slate-500` que restou

### Leva 6 — Estrutura *(contínuo, fatiável)*
17. `DUP-02` — esqueleto comum do "apagar com ajustes", **carregando a transação**
18. `DUP-03` + `CTR-02` — `useRecurso<T>` substituindo os 22 hooks copiados
19. `ESC-02` — `annotate` na equipe (junto do `ERR-01`, mesma linha)
20. `ARQ-01` — extrair camadas do `search`
21. `TST-01` — testes por risco: `auth`, `equipe`, `recorrencias` (`TST-04`)
22. `TST-03` — helper de mock de `api` que falha alto
23. `ERR-08` + `CTR-01` — validação na fronteira com Zod, endpoint a endpoint, começando pelos de dinheiro

---

## 6. Apêndice — estado dos achados anteriores

| ID | Audit | Situação hoje | Evidência |
|---|---|---|---|
| `QUEBRA-01` | Qualidade | ✅ **Corrigido** | `SecaoLancamentos.tsx` existe e é usado pelas 2 rotas |
| `QUEBRA-02` | Qualidade | ✅ **Corrigido** | nenhum `text-white` em input de `app/(auth)/` |
| `QUEBRA-03` | Qualidade | ✅ **Corrigido** | `getErrorMessage` trata `Error` nativo e é idempotente |
| `INC-01` | Qualidade | ✅ **Corrigido** | mesma unificação do `QUEBRA-01` |
| `INC-02` | Qualidade | ❌ **Aberto** | `sidebarOpen: true` + overlay `md:hidden` → `ERR-09` |
| `INC-03` | Qualidade | ✅ **Corrigido** | zero cópias locais de `formatCurrency` |
| `INC-04` | Qualidade | ❌ **Piorou** | 28 → 42 arquivos → `DUP-01` |
| `UX-01` | Qualidade | ❌ **Piorou** | "únicos dois" → **30** → `ERR-07` |
| `UX-02` | Qualidade | ✅ **Corrigido** | ver `lib/api.ts` (envelope de resposta inválida) |
| `UX-03` | Qualidade | 🟡 **Quase** | 1 `placeholder-slate-500` restante |
| `COD-01` | Qualidade | ✅ **Corrigido** | ESLint 9 + `eslint.config.mjs` + `"lint": "eslint ."` |
| `COD-02` | Qualidade | ✅ **Corrigido** | `formatCurrency(valor: unknown)`, robusta, + 2 variantes |
| `MED-01` | Segurança | ⚠️ fora do escopo desta auditoria (upload) | — |
| `BAIXO-02` | Segurança | ✅ coberto estruturalmente | recorte por empresa antes de todo filtro |

> Os dois "piorou" não contradizem o crédito da seção 1. O que foi corrigido foi corrigido **bem** — e o que regrediu são os dois itens que **não tinham guarda automática**. É a evidência mais direta a favor do item 12 da Leva 4.

---

## 7. Nota sobre a PR #54 (`feature/agenda-vinculos`)

Auditada a pedido, no mesmo rigor. Ela **não introduz achado novo** e não aparece em nenhum 🔴. O que ela acrescenta aos números:

- **+1** `} catch {` (`useBuscaVinculo.ts:80`) — mas **documentado como deliberado**, com justificativa escrita: o vínculo é opcional, e um toast de erro por não listar projetos atrapalharia quem só quer marcar um compromisso. Está na allowlist que o `ERR-07` propõe, não na lista de correção.
- **+2** chamadas de data à mão (`DUP-01`), e um **nono contorno** do `ERR-03` (`split("-")` remontado em `useAgenda.ts:242`) — com comentário explicando exatamente o bug do fuso. É evidência a favor do `ERR-03`: mais um autor descobriu o problema sozinho e remendou do seu jeito.
- **+2** `as unknown as` (`ERR-08`).

Em contrapartida, ela anda na direção certa em dois pontos que esta auditoria recomenda em geral:

- criou **um** hook de busca com debounce (`useBuscaVinculo`) em vez de copiar o bloco do cliente pela terceira vez — exatamente o remédio do `DUP-03`, e pelo motivo certo, dito no comentário: copiar era como o bug do debounce morto voltaria;
- incluiu **teste de contagem de queries** (`CaptureQueriesContext` em `test_agenda_vinculos.py`) contra N+1 — a ferramenta que o `ESC-01` pede e que nenhum outro módulo usava.

Se a #54 mergear antes das correções, nenhuma leva deste plano muda.

---

*Auditoria por leitura de código, varredura de padrões e verificação em execução. As medições de query, de formatação de data e da contagem da equipe foram obtidas rodando o código, com sondas temporárias criadas e removidas — nenhum arquivo de teste foi deixado no repositório. **Nenhuma linha de código de produção foi alterada nesta branch.** O único artefato é este documento.*

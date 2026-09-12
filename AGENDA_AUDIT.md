# 📅 Auditoria da Agenda + Viabilidade do Google Calendar — Synapse

**Branch:** `audit/agenda`
**Baseline:** `master` @ `3485081`
**Natureza:** auditoria e estudo de viabilidade. Nenhuma linha de código de produção foi alterada.
**Escopo lido:** `backend/modules/agenda/*` (460 linhas), `frontend/components/agenda/*` + `app/(dashboard)/agenda/page.tsx` + `hooks/useAgenda.ts` + `types/agenda.ts` (818 linhas), `backend/tests/test_agenda.py` (240 linhas), o tema do calendário em `globals.css`, e as duas integrações que hoje encostam na agenda (follow-up → evento, evento → cliente).

---

## 1. Resumo Executivo

### Nota: **5 / 10**

Não é uma nota de "está quebrado". É uma nota de **encanamento bom, produto magro**.

O que está construído está bem construído: a arquitetura em camadas é respeitada (view → service → repository), o isolamento multi-tenant está correto e **testado** (240 linhas de teste, incluindo o caso de vazamento entre empresas e o de vincular cliente de outra empresa), o cache é invalidado nas três escritas, a paginação existe e o frontend a percorre até o fim, e o tema escuro do `react-big-calendar` foi reescrito inteiro com os tokens do sistema — nenhuma cor de tema hardcoded. Se a nota fosse só de backend, seria 7.

O problema é o outro lado: como **produto**, a agenda é um formulário de cadastro com um calendário desenhado em volta. Ela guarda. Ela não devolve nada.

### Os 3 problemas mais gritantes

**1. A agenda não avisa ninguém de nada. Nunca.**
Não existe lembrete, não existe notificação, não existe e-mail, não existe task no Celery. O `beat_schedule` tem entradas para financeiro, estoque, CRM, recorrências, empréstimos e vendas fiadas — **nenhuma para a agenda** (`backend/config/celery.py:30`). O módulo `notificacoes` nem sequer tem `"agenda"` na lista de tipos (`backend/modules/notificacoes/models.py:11`). Marcar um compromisso no Synapse hoje tem exatamente o mesmo efeito prático de anotar num papel que você precisa lembrar de ir olhar.

**2. No celular, o mês é ilegível — e a visão que resolveria isso já está traduzida no código, apenas desligada.**
`views={[Views.MONTH, Views.WEEK, Views.DAY]}` (`AgendaCalendario.tsx:96`). A biblioteca oferece uma quarta visão, `Views.AGENDA`, que é uma **lista** — e o arquivo já tem a tradução dela pronta: `agenda: "Agenda"` e `noEventsInRange: "Nenhum evento neste período."` (`AgendaCalendario.tsx:40-41`). Alguém traduziu a visão de lista e não a ligou. Em 375px de largura, sete colunas dão ~50px cada; um evento chamado "Reunião com fornecedor" vira três pixels de retângulo roxo.

**3. A agenda é um beco sem saída no sistema.**
Do evento dá para ir ao cliente (`EventoDetalhe.tsx:63`). Do cliente **não** dá para ver os eventos dele — o perfil do cliente só oferece *criar* um evento de follow-up e nunca mostra os que existem. O dashboard não sabe que a agenda existe. A busca global não indexa eventos (`modules/search` não menciona agenda). O compromisso entra e some.

### Google Calendar é viável agora?

**Tecnicamente sim, estrategicamente não.** É um subprojeto de 1–2 semanas de código para o caminho mais simples (mão única), mais uma espera de **semanas** pela verificação do Google que não depende de nós — e, pior, resolver o Google **não resolve** o "não tem muita graça": empurrar os eventos para fora só torna a agenda do Synapse um formulário de entrada que ninguém precisa abrir. Veredito completo na seção 3.

### O que o fundador quis dizer com "não tem muita graça"

Vale nomear, porque a resposta muda o que se constrói.

Não é falta de recursos avançados — recorrência e convidados não são o que está faltando para um dono de negócio pequeno. E não é falta de polimento visual: o tema está bem-feito.

É que **a agenda não participa do dia**. Um sistema tem "graça" quando ele te procura. O financeiro procura (verifica vencimentos às 8h). O estoque procura (avisa estoque mínimo às 7h). O CRM procura (follow-up hoje, às 9h). A agenda é o único módulo do Synapse que **só funciona se você lembrar de ir até ele** — que é precisamente o trabalho que uma agenda deveria fazer por você.

Some a isso três detalhes que tiram o sangue da tela:

- **O seletor de cor não significa nada.** Existem 10 cores (`types/agenda.ts:34`), o usuário escolhe uma, e em lugar nenhum do sistema há uma legenda dizendo o que cada uma quer dizer. Duas semanas depois ninguém lembra por que aquele evento é laranja. É decoração, não informação.
- **Tela vazia é tela vazia.** Sem eventos, o mês é uma grade em branco sem uma palavra de orientação. A única mensagem de vazio que existe (`noEventsInRange`) só aparece na visão de lista — que está desligada.
- **O detalhe do evento mostra menos do que o backend manda.** O serializer envia `criado_por_nome` (`serializers.py:47`); o `EventoDetalhe` nunca usa. Numa empresa com equipe, "quem marcou isso?" é a primeira pergunta — e o dado já está na resposta.

---

## 2. Raio-X: o que existe, o que está fraco, o que falta

### 2.1 O que existe hoje ✅

| Recurso | Estado | Onde |
|---|---|---|
| Visões mês / semana / dia | ✅ funciona | `AgendaCalendario.tsx:96` |
| Criar clicando num dia/slot | ✅ funciona, 1h de duração padrão | `agenda/page.tsx:76-81` |
| Editar / excluir com confirmação | ✅ funciona, sem duplo clique | `agenda/page.tsx:107-122` |
| Vínculo evento ↔ cliente | ✅ **funciona**, com guarda multi-tenant | `serializers.py:69`, testado |
| Follow-up → evento na Agenda | ✅ **funciona**, e não duplica | `clientes/services.py:470` |
| Cores por evento | ⚠️ funciona, mas não significa nada | `EventoForm.tsx:248` |
| Dia inteiro | ⚠️ existe, mas é meio decorativo (ver 2.2) | `models.py` |
| Filtro por intervalo visível | ✅ query correta de sobreposição | `repository.py:27-38` |
| Cache + paginação | ✅ TTL 120s, invalidação nas 3 escritas | `repository.py:14`, `services.py` |
| Multi-tenant | ✅ correto e testado | `test_agenda.py:173-197` |
| Gating de módulo (`modulo_agenda`) | ✅ backend e sidebar | `views.py:39`, `Empresa.modulo_agenda` |
| Tema escuro/claro do calendário | ✅ bem-feito, via tokens | `globals.css:164-260` |
| Responsivo / mobile | ❌ **não** (ver 2.2) | — |
| Notificações / lembretes | ❌ **não existem** | — |

**Duas coisas que o fundador pode achar que estão quebradas e não estão:** o vínculo evento↔cliente funciona (inclusive recusando cliente de outra empresa, com teste), e o follow-up→agenda funciona (inclusive detectando duplicata e oferecendo atualizar, com teste). Esses dois, se parecem fracos, é por falta de *visibilidade* do resultado, não por defeito.

### 2.2 O que está quebrado ou fraco 🟠

Ordenado por quanto dói.

---

#### AG-01 — 🔴 A agenda não tem lembrete de espécie alguma

**Impacto:** o recurso que justifica a existência de uma agenda.
**Evidência:** `backend/modules/agenda/` não tem `tasks.py`. `config/celery.py:30-75` não tem entrada de agenda. `Notificacao.TIPO_CHOICES` (`notificacoes/models.py:11-20`) não tem `"agenda"`.

A infraestrutura toda já existe e está em uso por outros cinco módulos: `NotificacaoService.criar_notificacao(...)` para o sino, e envio de e-mail via Resend (já usado em `auth/tasks.py`, `equipe/tasks.py`, `equipe/emails.py`). Falta só a task e o campo de "quando avisar" no modelo. Isto **não é um subprojeto**.

---

#### AG-02 — 🔴 Visão de lista desligada + mês inutilizável no celular

**Impacto:** um dono de negócio olha a agenda no telefone, entre um compromisso e outro. É o caso de uso principal, e é o pior atendido.
**Evidência:** `AgendaCalendario.tsx:96` omite `Views.AGENDA`; `agenda/page.tsx:149` fixa `h-[75vh]` sem tratamento por largura; as traduções da visão de lista já estão em `MENSAGENS` (`:40-41`), esperando.

A correção literal é acrescentar `Views.AGENDA` ao array. O bom acabamento é escolher a visão inicial por largura de tela (lista no celular, mês no desktop).

---

#### AG-03 — 🟠 "Dia inteiro" não faz o que o nome diz

**Evidência:** `EventoForm.tsx:182-211`. A caixa "Dia inteiro" é marcada, e os dois campos de hora continuam visíveis, editáveis e são enviados como estão. O backend guarda o intervalo cru (`models.py`, sem normalização). Um evento marcado como dia inteiro das 14:00 às 15:00 é gravado exatamente assim; o calendário o desenha na faixa de dia inteiro e o `EventoDetalhe` imprime "Dia inteiro" (`EventoDetalhe.tsx:24`) escondendo a hora que está lá.

Não corrompe nada, mas é um campo que mente. O certo: ao marcar, esconder as horas e normalizar para 00:00→23:59.

---

#### AG-04 — 🟠 Busca de cliente sem debounce: uma requisição por tecla

**Evidência:** `EventoForm.tsx:74` declara `buscaTimer`, `:99` faz `clearTimeout` dele — e **nada nunca o atribui**. O `useEffect` de `:77` dispara `buscarClientes` a cada mudança de `buscaCliente`.

O debounce foi escrito pela metade e está morto. Digitar "Fernanda" dispara oito chamadas a `/clientes/`. Funciona, é só desperdício — mas é desperdício num endpoint paginado com `page_size: 25`.

---

#### AG-05 — 🟠 Labels sem `htmlFor` no formulário de evento

**Evidência:** `EventoForm.tsx:158, 172, 194, 203, 214, 226, 249` — todos os `<label>` são visuais; nenhum `input` tem `id`.

Leitor de tela não associa rótulo ao campo, e clicar no rótulo não foca o campo. **É o mesmo defeito que registrei no `ProjetoForm` no PR #48** — não é da agenda, é um padrão que se repete. Vale tratar como item transversal de acessibilidade, não como bug de agenda.

---

#### AG-06 — 🟡 `criado_por` é enviado e descartado

**Evidência:** `serializers.py:47` calcula `criado_por_nome`; `types/agenda.ts:17` declara o campo; `EventoDetalhe.tsx` nunca o exibe. Dado pago e jogado fora — e relevante assim que a empresa tem mais de uma pessoa.

---

#### AG-07 — 🟡 Qualquer pessoa da empresa edita e apaga o evento de qualquer outra

**Evidência:** `views.py:105` — `[IsAuthenticated, IsEmpresaMember, ModuloAtivo]`. Não há checagem de autoria nem de perfil.

Marco isto como **decisão de produto em aberto**, não como bug: para uma agenda de empresa compartilhada, isso pode ser exatamente o desejado. Mas é uma decisão que ninguém tomou explicitamente, e o `EventoDetalhe` sequer mostra de quem é o evento (AG-06) — então a pessoa apaga o compromisso do colega sem nunca ter visto que era dele.

---

#### AG-08 — 🟡 `AgendaService` levanta `ValueError` em vez da exceção do sistema

**Evidência:** `services.py:27` — `raise ValueError("Evento não encontrado.")`, enquanto o resto do sistema usa `ResourceNotFound` de `shared.exceptions`.

Hoje não vaza para o usuário porque a view intercepta antes (`views.py:127` faz o `_get` que levanta o `NotFound` do DRF, e o `delete` captura o `ValueError` explicitamente em `:123`). Mas é uma exceção fora do padrão, capturada por sorte de ordenação. O `_update` (`:135-143`) busca o evento **duas vezes** pelo mesmo motivo: uma na view, outra dentro do `atualizar_evento`.

---

#### AG-09 — 🔵 Zero testes de frontend para a agenda

**Evidência:** o único teste que encosta no assunto é `frontend/components/clientes/FollowupAgendaModal.test.tsx`, que é do CRM. Não há teste para `AgendaCalendario`, `EventoForm`, `EventoDetalhe` nem para a página.

Contraste: o backend tem 240 linhas de teste cobrindo CRUD, vínculo, multi-tenant, intervalo, paginação e 401. A assimetria é grande, e é justamente no frontend que estão AG-03 e AG-04.

---

#### AG-10 — 🔵 Agenda fora do dashboard e fora da busca

**Evidência:** `modules/dashboard/services.py` não consulta `Evento` (os "eventos" que ele monta em `:442` são itens de feed de atividade, outra coisa). `modules/search` não menciona agenda.

---

### 2.3 O que falta — priorizado pelo valor para o dono do negócio

A ordem abaixo é minha recomendação, e o critério é simples: **o que faz a pessoa abrir menos o sistema e perder menos compromisso.**

| # | Recurso | Valor | Esforço | Por quê nessa posição |
|---|---|---|---|---|
| **1** | **Lembrete** (sino + e-mail, X minutos/horas antes) | 🔥 altíssimo | baixo | É o motivo de existir de uma agenda. Infra pronta (Resend + `NotificacaoService` + Celery beat). Falta um campo no modelo e uma task. |
| **2** | **Visão de lista** (`Views.AGENDA`) | 🔥 alto | ~trivial | Uma linha. Resolve o celular, que é onde a agenda é consultada. Tradução já escrita. |
| **3** | **Agenda no dashboard** ("hoje você tem 3 compromissos") + **eventos no perfil do cliente** | 🔥 alto | baixo | Transforma a agenda de destino em informação. Ataca direto o "não tem muita graça". |
| **4** | **Arrastar para remarcar** | alto | baixo-médio | O `react-big-calendar@1.20` **já traz** o addon `withDragAndDrop`, e o `PATCH /agenda/{id}/` já existe. É ligação, não construção. |
| **5** | **Categorias com nome** (em vez de 10 cores mudas) | médio-alto | baixo | Dá significado ao que já existe. "Reunião / Entrega / Pessoal / Cobrança" com cor fixa e legenda. |
| **6** | **Eventos recorrentes** | médio-alto | 🔴 **alto** | O único item desta lista que é subprojeto de verdade. Ver nota abaixo. |
| **7** | **Vínculo com projeto / venda** | médio | baixo-médio | O CRM já provou o padrão com o follow-up. Mesma forma, outro módulo. |
| **8** | **Horário de trabalho** (`min`/`max` na visão de dia/semana) | médio | ~trivial | Hoje a semana mostra 24h; ~10 delas são madrugada vazia ocupando metade da tela. Props nativas da biblioteca. |
| **9** | **Duração padrão configurável** | baixo-médio | trivial | Hoje é 1h fixa no código (`page.tsx:79`). |
| **10** | **Convidados / participantes** | baixo | alto | Exige convite, resposta, e-mail, estado. Para um dono de negócio pequeno, o WhatsApp já faz isso. **Só faz sentido junto do Google Calendar**, que resolve convite de graça. |

> **Nota sobre recorrência (#6):** é a armadilha clássica. Não é "repetir toda terça" — é RRULE, exceções ("essa semana é quinta"), o diálogo "editar só este / este e os seguintes / todos", e o efeito disso na query por intervalo, que hoje é um `filter` simples de sobreposição (`repository.py:27`). Materializar ocorrências vira lixo no banco; calcular em tempo real vira complexidade na listagem e quebra o cache atual. **O Synapse já tem uma cicatriz exatamente desse tipo**: o comentário em `config/celery.py:37-39` conta que as recorrências do financeiro precisaram ser refeitas por criarem pendências automáticas erradas. Recorrência na agenda merece sua própria branch, seu próprio diagnóstico, e não deve ser enfiada junto com os itens 1–5.

---

## 3. Google Calendar — estudo de viabilidade

### 3.1 Pré-requisitos externos (o que não depende de nós)

| Item | Situação | Observação |
|---|---|---|
| Projeto no Google Cloud | ⬜ a criar | Gratuito, minutos. |
| Google Calendar API habilitada | ⬜ a habilitar | Gratuito. |
| Credenciais OAuth 2.0 (Web application) | ⬜ a criar | Client ID + secret. Redirect URI precisa do domínio final. |
| Tela de consentimento (External) | ⬜ a configurar | Exige logo, política de privacidade e termos **publicados em domínio verificado**. |
| **Verificação do app pelo Google** | ⚠️ **o gargalo** | Ver abaixo. |
| Custo da API | ✅ **zero** | A Calendar API não é cobrada. Cota padrão é folgada (ordem de 10⁶ chamadas/dia); irrelevante nesta escala. |

**O gargalo é a verificação.** Os escopos de calendário são classificados pelo Google como **sensíveis** — não são os "restritos" (Gmail/Drive completos) que exigem auditoria de segurança paga por terceiros, e isso é uma boa notícia. Mas escopo sensível exige o processo de verificação: domínio verificado, política de privacidade, justificativa de uso e vídeo demonstrativo do fluxo. É **gratuito**, e a espera na prática costuma ser de **semanas** (relatos comuns na faixa de 2 a 6, com idas e voltas se algo for pedido de novo).

**A armadilha do modo "Testing":** enquanto o app não é verificado, ele pode rodar em modo de teste com um número limitado de usuários (ordem de 100). O detalhe que pega as pessoas: **em modo de teste, o refresh token expira em ~7 dias**. Ou seja, um piloto não-verificado obriga cada usuário a reconectar toda semana — o que é aceitável para o fundador testar e inaceitável para clientes reais.

**Escopos, do mais barato ao mais caro:**

| Escopo | O que dá | Custo de verificação |
|---|---|---|
| `calendar.app.created` | Acesso **apenas** a um calendário secundário que o próprio app cria | ⚠️ **potencialmente o mais leve** — confirmar |
| `calendar.events` | Ler/escrever eventos dos calendários do usuário | Sensível → verificação |
| `calendar` | Calendários inteiros, incluindo configurações | Sensível → verificação, e pede mais justificativa |

> **Precisa ser confirmado na documentação viva do Google antes de qualquer decisão.** A classificação de escopos e as regras do modo de teste mudam com frequência, e estou descrevendo o estado que conheço, não uma consulta feita hoje. Se `calendar.app.created` de fato dispensar (ou aliviar) a verificação, isso **muda o cronograma inteiro** — e, por sorte, é exatamente o escopo que combina com a arquitetura que eu recomendaria de qualquer jeito (seção 3.4).

### 3.2 Decisões de sincronização

Estas são decisões do fundador, não técnicas. Registro cada uma com a recomendação e o motivo.

**a) Mão única ou mão dupla?**
→ **Mão única (Synapse → Google), no começo.**
Mão dupla exige, em Google, ou `events.watch` (notificações push para um endpoint HTTPS público, com canais que expiram e precisam ser renovados) ou varredura periódica com `syncToken`. E exige resolver o **laço**: uma escrita nossa dispara um evento do Google que não pode nos fazer escrever de volta. É esse laço, e não a API, que consome o cronograma.

**b) Quem ganha no conflito?**
→ **Synapse ganha, enquanto for mão única** — o Google é espelho, não fonte. Quando (se) virar mão dupla: o mais recente por timestamp `updated`, com uma exceção dura descrita em (d).

**c) Sincroniza tudo ou só os marcados?**
→ **Tudo, dentro de um calendário separado chamado "Synapse".**
Um seletor por evento parece dar controle, mas é uma decisão a mais em cada cadastro, para sempre. Um calendário dedicado dá **mais** controle com **menos** código: o usuário liga e desliga a camada inteira dentro do próprio Google, com a interface que ele já conhece, e nada nosso se mistura com os eventos pessoais dele.

**d) Deleção de um lado — o ponto perigoso**
→ **Deletar no Google NUNCA deve apagar o evento no Synapse.**
O evento do Synapse pode carregar um vínculo com cliente que é dado de negócio; o do Google é uma cópia. Apagar no Google deve, no máximo, marcar o evento como dessincronizado. O inverso (apagar no Synapse remove do Google) é seguro e esperado.
Isto ecoa a regra de ouro que já vale no resto do sistema: **nada é apagado por efeito colateral de outro lugar.**

**e) O vínculo com cliente, que o Google não tem**
→ **`extendedProperties.private`.** A API do Google permite anexar pares chave/valor arbitrários a um evento; eles são invisíveis para o usuário, sobrevivem a edições e voltam nas leituras. É o lugar certo para `synapse_evento_id` e `synapse_cliente_id`. O nome do cliente ainda deve ir no corpo do evento em texto, para quem olha só pelo Google enxergar de quem se trata.

### 3.3 Impacto no sistema

**Muda o modelo?** Sim, mas pouco:
- `Evento` ganha `google_event_id`, `google_calendar_id`, `sincronizado_em` e `origem` (`"synapse"` / `"google"`).
- Um modelo novo, algo como `ContaGoogle`: `usuario`, `empresa`, `refresh_token`, `access_token`, `expira_em`, `calendar_id`, `escopos`, `sync_token`, `conectado_em`.
- Migração da agenda: hoje o módulo tem **só `0001_initial`** — nunca evoluiu. Seria a primeira alteração de esquema desde a v1.

**Multi-tenant: usuário conecta ou empresa conecta?**
→ **O usuário conecta.** Uma conta Google é de uma pessoa; o consentimento OAuth é pessoal e intransferível. Mas os eventos do Synapse são **da empresa** (`Evento.empresa`), e aí nasce uma tensão real: se três pessoas da empresa conectarem, o mesmo evento da empresa vai para três calendários. Mão única isso é ótimo (cada um vê a agenda da empresa no próprio Google). Mão dupla isso vira um problema de três donos para um evento — mais um motivo para a mão dupla ficar para depois.

**Onde guardar os tokens com segurança — e este é o ponto que exige atenção:**
Hoje **não há nenhuma biblioteca de criptografia no backend** (nenhum uso de `Fernet`/`cryptography` em todo o repositório). Um refresh token do Google é uma credencial de longa duração para a agenda inteira de uma pessoa. Guardá-lo em coluna de texto puro seria o segredo mais valioso do banco, sem proteção.

Isto adiciona ao escopo, obrigatoriamente:
1. `cryptography` nas dependências e um campo cifrado para os tokens;
2. um segredo novo (`GOOGLE_TOKEN_ENCRYPTION_KEY`) no padrão `config(...)` que o `settings/base.py` já usa;
3. **revogação do token** ao desconectar — desconectar precisa chamar o endpoint de revoke do Google, não só apagar a linha;
4. os tokens nunca podem aparecer em log nem em serializer.

A `SECURITY_AUDIT.md` já registrou pendências de infraestrutura. Integrar o Google **eleva o valor do banco como alvo** — é uma consideração de segurança, não só de produto.

### 3.4 Veredito

> **Vale a pena, mas não agora. E, quando for a hora, na versão pequena.**

**Vale agora ou depois de publicar? → Depois.** Três motivos, em ordem de peso:

1. **A verificação do Google trava o cronograma e não depende de nós.** Publicar não pode ficar esperando uma fila externa de semanas. E o modo de teste, com o refresh token de 7 dias, não serve para cliente real.
2. **O pré-requisito da verificação é justamente o que ainda não existe:** domínio verificado, política de privacidade e termos publicados. Isso vem *com* a publicação, não antes dela.
3. **O argumento mais forte é de produto, não de prazo.** O Google Calendar **não responde** ao "não tem muita graça" — ele o contorna. Se tudo aparece no Google de qualquer jeito, o usuário passa a viver no Google, e a agenda do Synapse vira um formulário de digitação que ninguém abre por vontade própria. Integrar uma agenda fraca é um jeito caro de aposentá-la. **Primeiro a agenda precisa valer a pena ser aberta; depois ela ganha uma ponte para fora.**

**Subprojeto grande ou contido?**

- **Mão única, calendário dedicado, sem webhook:** contido. Ordem de **1 a 2 semanas** de código (fluxo OAuth, cifragem e renovação de token, criação do calendário, push nas três escritas, tela de conectar/desconectar, tratamento de token revogado). Em paralelo, a espera da verificação.
- **Mão dupla:** **subprojeto grande**, na faixa de **3 a 4 vezes** o anterior. Webhook público, renovação de canais que expiram, `syncToken` e sincronização incremental, prevenção de laço, regra de conflito, reconciliação quando o token venceu e o mundo mudou enquanto estávamos fora. É aqui que integrações de calendário costumam estourar o prazo, e não na API em si.

**Recomendação honesta de esforço × valor:** os itens **1 a 5** da seção 2.3 somados custam **menos** que a integração mão única e entregam **mais** valor percebido no dia a dia — porque atacam a queixa real. O Google Calendar é um ótimo item de segunda leva: excelente para vender (todo mundo entende "sincroniza com o Google"), fraco para consertar o que está incomodando hoje.

---

## 4. Proposta de faseamento

### Fase A — "a agenda começa a te procurar" 🔥
*Rápido, alto valor, nenhuma decisão de arquitetura pendente. É a resposta direta ao "não tem muita graça".*

1. **Lembrete**: campo de antecedência no `Evento` + `agenda/tasks.py` + entrada no `beat_schedule` + `"agenda"` em `Notificacao.TIPO_CHOICES`. Sino primeiro; e-mail via Resend logo atrás.
2. **Visão de lista** (`Views.AGENDA`) e visão inicial por largura de tela.
3. **Agenda no dashboard** ("hoje: 3 compromissos") e **eventos no perfil do cliente**.
4. **Horário de trabalho** nas visões de dia/semana (`min`/`max`).
5. Correções de acabamento: AG-03 (dia inteiro), AG-04 (debounce morto), AG-06 (mostrar quem criou), AG-05 (labels — de preferência junto com o `ProjetoForm`, por ser o mesmo defeito).
6. Primeiros testes de frontend da agenda (AG-09), começando pelos itens acima.

### Fase B — "a agenda fica boa de usar"
1. **Arrastar para remarcar** (addon já instalado, `PATCH` já existe).
2. **Categorias com nome e legenda**, no lugar das 10 cores mudas.
3. **Vínculo com projeto e com venda**, no mesmo padrão que o follow-up do CRM já estabeleceu.
4. Duração padrão configurável.
5. Padronizar `AgendaService` em `shared.exceptions` e eliminar a busca dupla no `_update` (AG-08).

### Fase C — subprojeto: **Eventos recorrentes**
Branch própria, diagnóstico próprio. Decidir antes de codar: materializar ocorrências ou calcular na hora; o que acontece com o cache atual; e como fica o diálogo "editar este / os seguintes / todos". Há precedente doloroso no próprio Synapse (as recorrências do financeiro) que deve ser lido antes de começar.

### Fase D — subprojeto: **Google Calendar (mão única)**
**Só depois de publicar**, e só depois da Fase A. Começar pelo trabalho de fora — tela de consentimento, política de privacidade, domínio verificado, submissão à verificação — **antes** de escrever código, porque a fila é o caminho crítico. Confirmar na documentação do Google, logo no primeiro dia, se `calendar.app.created` alivia a verificação: se aliviar, a fase inteira encolhe.

### Fase E — mão dupla, convidados
Só se a Fase D for usada de verdade e alguém pedir. Não construir por antecipação.

---

## Anexo — mapa do módulo

**Backend — 460 linhas** (`backend/modules/agenda/`)
`models.py` 59 · `repository.py` 72 · `serializers.py` 89 · `services.py` 59 · `views.py` 148 · `urls.py` 13 · `admin.py` 12 · migrations: **só `0001_initial`**

**Frontend — 818 linhas**
`components/agenda/EventoForm.tsx` 287 · `app/(dashboard)/agenda/page.tsx` 194 · `components/agenda/AgendaCalendario.tsx` 112 · `components/agenda/EventoDetalhe.tsx` 99 · `hooks/useAgenda.ts` 88 · `types/agenda.ts` 38 · tema do calendário em `app/globals.css:164-260`

**Testes**
Backend: `backend/tests/test_agenda.py` — 240 linhas (CRUD, vínculo com cliente, multi-tenant, intervalo, paginação, 401). Frontend: **nenhum**.

**Campos do `Evento` hoje**
`titulo`, `descricao`, `data_inicio`, `data_fim`, `dia_inteiro`, `local`, `cor`, `cliente` (FK opcional), `criado_por`, `criado_em`, `atualizado_em`.
**Não existem:** recorrência, lembrete, participantes, categoria, status, vínculo com projeto ou venda, e nenhum campo de integração externa.

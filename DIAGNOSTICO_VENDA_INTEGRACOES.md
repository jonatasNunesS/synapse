# Diagnóstico — as integrações da Venda não aparecem

Branch: `fix/venda-integracoes-diagnostico` · Base: `master` (`f9f25de`)
Natureza: **diagnóstico. Nenhuma linha de produção foi alterada nesta branch.**

---

## Resumo em uma linha

**A Fase 3A nunca entrou em `master`.** O PR #43 continua **aberto e em draft** —
`merged: false`. O que está no ar é a Fase 1, onde criar a venda deliberadamente
não faz nada. Os sintomas 1 e 2 não são bugs do código da 3A: é a ausência dele.

O sintoma 3 é **diferente** e sobreviveria ao merge — ele é um buraco real da
própria 3A.

---

## A prova

```
$ git log --oneline origin/master -1
f9f25de Vendas: comando que migra as vendas antigas, sem apagar nenhuma

$ git merge-base --is-ancestor 358b348 origin/master
NAO

$ git branch -a --contains 358b348
  feature/venda-entidade-fase3a-integracoes
  remotes/origin/feature/venda-entidade-fase3a-integracoes
```

PR #43 pela API do GitHub: `"state": "open"`, `"draft": true`, `"merged": false`,
`"mergeable_state": "clean"`, base `f9f25de` — que é exatamente o head de `master`.
Nada da 3A foi aplicado.

O que existe em `master` hoje, no módulo de vendas:

| Peça da 3A | Em `master`? |
| --- | --- |
| `VendaService.baixar_estoque` / `lancar_financeiro` | não — `services.py` ainda diz *"Fase 3: baixar estoque e lançar no financeiro a partir daqui."* |
| `GET/POST /api/vendas/{id}/estoque/` | não — `urls.py` tem só `""` e `"<uuid:pk>/"` |
| `POST /api/vendas/{id}/financeiro/` | não |
| `Movimentacao.venda` (FK) | não |
| `frontend/components/vendas/VendaIntegracoes.tsx` | **o arquivo não existe** |
| `vendaIntegracoes` em `useVendas.ts` | não |
| `montarHistorico` em `lib/vendas.ts` | não |
| dedup `migrada_para_venda__isnull=True` | não |

Ou seja: em produção não há endpoint para chamar nem botão para clicar. A tela
está correta em não mostrar nada — não há nada para mostrar.

---

## Sintoma 1 — a pergunta "baixar do estoque?" não aparece

**Causa: a 3A não está em `master`.**

`VendaService.criar` no ar hoje:

```python
@staticmethod
def criar(empresa_id, usuario_id, dados: dict) -> Venda:
    itens = dados.pop("itens")
    dados.pop("_subtotal_previsto", None)
    return VendaRepository.criar(empresa_id, usuario_id, dados, itens)
    # Fase 3: baixar estoque e lançar no financeiro a partir daqui.
```

Isso foi escrito assim de propósito na Fase 1 (para não duplicar efeito enquanto
o fluxo de `InteracaoCliente` ainda existia) e continua exatamente assim.

**Causa secundária, que aparece depois do merge:** mesmo com a 3A dentro, a
pergunta continua **não** aparecendo ao criar a venda. Ela só existe dentro do
`VendaDetalheModal`, e só quando o modal recebe `onAtualizada`:

```tsx
{onAtualizada && (
  <VendaIntegracoes venda={venda} onAtualizada={onAtualizada} />
)}
```

Isto é: hoje a 3A exige que a pessoa **salve a venda, feche o formulário, ache a
linha na lista e clique no nome do cliente** para só então ver o botão. Não há
nada no caminho do salvar. Merjar a 3A resolve o sintoma "não existe em lugar
nenhum", mas não resolve "não aparece na hora de vender".

---

## Sintoma 2 — a pergunta "lançar no financeiro?" não aparece

**Mesma causa, mesmo caminho.** O botão "Lançar R$ X no financeiro" mora no
mesmo `VendaIntegracoes.tsx`, atrás do mesmo modal de detalhe.

---

## Sintoma 3 — a venda não aparece na timeline do cliente

**Causa diferente das outras duas, e ela não é resolvida pelo merge da 3A.**

`app/(dashboard)/clientes/[id]/page.tsx` lê uma fonte só:

```tsx
const { interacoes, ... } = useInteracoes(id);
...
<TimelineInteracoes interacoes={interacoes} ... />
```

`TimelineInteracoes` nem tem prop `vendas`. Nenhuma tela do sistema chama
`/api/vendas/?cliente_id=...`. Uma `Venda` não tem por onde chegar ali.

Na 3A eu escrevi `montarHistorico(interacoes, vendas)` em `frontend/lib/vendas.ts`
e cinco testes para ela. Conferindo a branch:

```
$ git grep -ln "montarHistorico" 358b348 -- frontend
(só lib/vendas.ts e lib/vendas.test.ts)
```

**A função foi escrita, testada e nunca montada em tela.** Os testes passam
porque testam a função pura, isolada, que de fato está certa. Ninguém a chama.

### E tem um agravante que precisa ser dito

A 3A **remove** da timeline as interações migradas
(`migrada_para_venda__isnull=True` em `ClienteRepository.listar_interacoes`) sem
colocar a Venda no lugar. Se o PR #43 for mergeado como está, as **22 vendas
migradas somem do histórico dos clientes**. Hoje elas ainda aparecem (como
interação) só porque a 3A não subiu.

Isso é regressão de dado visível ao usuário e, na minha leitura, é o item mais
urgente dos três.

---

## O que a entrega da 3A afirmou, e onde ela escorregou

O corpo do PR #43 diz, na seção "Timeline do cliente":

> A interação que virou Venda deixa de ser listada (`migrada_para_venda__isnull=True`).
> Ela continua no banco, intacta — mas quem representa aquela venda agora é a Venda,
> que tem itens e integrações.

A frase está factualmente correta sobre o backend e **falsa na implicação**: "quem
representa aquela venda agora é a Venda" só valeria se a Venda estivesse sendo
renderizada — e não está. Eu descrevi a metade que fiz (a dedup) como se fosse a
solução inteira (dedup + merge). Não é ressalva de redação: é um buraco funcional
que o texto encobriu.

Sobre as integrações, o PR não mentiu — ele diz "as duas **perguntam antes**" e
"criar a venda continua não disparando nada", o que é verdade. O que ele não diz,
e deveria, é **onde** a pergunta aparece. Escondida atrás de dois cliques no
detalhe, ela é, na prática, invisível para quem está vendendo.

---

## Por que os testes passam se nada funciona

Três desacoplamentos distintos, todos reais:

**1. Os testes de backend chamam os endpoints direto.**
`backend/tests/test_vendas_integracoes.py` faz `POST /api/vendas/{id}/estoque/`
com o client de teste. Provam que o endpoint funciona — e ele funciona. Não
provam que alguma tela o chama, porque nenhum teste de backend pode provar isso.

**2. Os testes de frontend mockam a camada de rede e renderizam o componente sozinho.**

```tsx
vi.mock("@/hooks/useVendas", () => ({ vendaIntegracoes: { ... } }));
...
render(<VendaIntegracoes venda={venda(extra)} onAtualizada={onAtualizada} />);
```

`VendaIntegracoes` nunca é renderizado a partir da página de vendas em teste
nenhum. O teste monta o componente à mão, no vácuo. Ele responde "o componente
se comporta bem *quando montado*" — e a pergunta que ninguém fez foi "ele é
montado?".

**3. Um teste afirma o próprio sintoma como comportamento correto.**
`test_criar_venda_ainda_NAO_baixa_nem_lanca_sozinha` assevera que criar a venda
não dispara nada. Ele está verde e está certo em relação à especificação que eu
segui ("as duas perguntam antes, nada acontece por criar a venda"). Só que a
especificação cobria *não agir sozinho* e eu li como *não oferecer no momento da
venda*. São coisas diferentes, e a segunda é o que quebrou na prática.

**A lacuna comum:** não existe nenhum teste que renderize `VendasPage`, crie uma
venda e verifique que a pergunta aparece. Nenhuma das três camadas testadas
cruza a fronteira onde o defeito mora.

---

## Proposta de correção — descrita, não aplicada

### Passo 0 — decidir o PR #43

Nada abaixo faz sentido antes disso. Duas saídas:

- **(a)** Tirar o draft, esperar a Vercel verde e mergear — aí os passos 1 e 2
  entram numa branch nova em cima do master já com a 3A.
- **(b)** Deixar o #43 aberto e levar as correções para dentro dele, para que
  master receba a 3A já com o buraco da timeline fechado.

Eu recomendo **(b)** — precisamente por causa do agravante do sintoma 3. Mergear
a 3A sozinha coloca em produção, mesmo que por poucas horas, um estado em que as
22 vendas migradas desaparecem do histórico do cliente. Uma decisão sua.

### Correção A — a pergunta no momento da venda (sintomas 1 e 2)

Copiar o encadeamento que o fluxo antigo já faz e que funciona. Em
`clientes/[id]/page.tsx` ele é isto:

```tsx
const nova = await registrar(dados);
if (nova?.tipo === "venda") {
  if (moduloAtivo("estoque")) setVendaParaEstoque(nova);
  else setVendaParaFinanceiro(nova);
}
```

e o `onClose` do modal de estoque encadeia no de financeiro.

Em `vendas/page.tsx`, o mesmo desenho:

1. `VendaForm.salvar` hoje faz `await onSubmit(...)` e **descarta o retorno**
   antes de `onClose()`. Precisa devolver a venda criada para a página — o hook
   `criar` já retorna `Promise<Venda>`, o form é que joga fora.
2. Ao voltar do `criar`, se `venda.tem_itens_com_produto` e o módulo Estoque
   estiver ativo, abrir a prévia de baixa (a mesma `VendaIntegracoes`, ou um
   modal fino que a envolva).
3. Ao fechar essa etapa — com baixa ou sem —, se `!venda.tem_lancamento_financeiro`,
   oferecer o lançamento. Igual ao antigo: estoque é opcional, financeiro é a
   pergunta que sempre vem.
4. As guardas ficam onde estão. Elas continuam sendo a última linha de defesa e
   nada muda no backend.

`VendaIntegracoes` já sabe se comportar; o que falta é alguém montá-la no
caminho do salvar. O modal de detalhe continua oferecendo as ações para quem não
respondeu na hora — isso não some.

### Correção B — a venda na timeline do cliente (sintoma 3)

`montarHistorico` já existe e já está testada. Falta ligá-la:

1. `clientes/[id]/page.tsx` busca também as vendas do cliente. O backend já
   suporta: `GET /api/vendas/?cliente_id=<id>` (o filtro está em
   `VendaService.listar`). Zero mudança de backend.
2. `montarHistorico(interacoes, vendas)` produz a lista única, já ordenada.
3. `TimelineInteracoes` passa a receber `EntradaHistorico[]` em vez de
   `InteracaoCliente[]`. A entrada carrega `origem`, que é o que decide as ações
   da linha: linha de interação mantém editar/apagar/descontar como hoje; linha
   de venda abre o detalhe da venda.

O passo 3 é o de maior custo — `TimelineInteracoes` hoje assume `InteracaoCliente`
em todo lugar. Estimo que seja o item mais pesado da correção e sugiro que ele
seja um commit próprio.

### Correção C — os testes que faltavam

Um teste de integração de tela, do tipo que não existe hoje: renderizar
`VendasPage`, criar uma venda com produto, e verificar que a pergunta do estoque
aparece. É o único teste que teria pego os sintomas 1 e 2. Análogo para a
timeline: renderizar a página do cliente com uma venda mockada na API e verificar
que a linha aparece no histórico.

---

## O que NÃO foi feito nesta branch

Nenhuma das correções acima. Nenhum arquivo de produção tocado — só este
documento. Aguardando sua decisão sobre o passo 0.

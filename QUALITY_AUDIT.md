# 🔍 Auditoria de Qualidade — Synapse

**Data:** 2026-08-18
**Base:** `master` @ `b8b77f3`
**Escopo:** qualidade (a segurança já foi auditada em `SECURITY_AUDIT.md`).
**Natureza desta branch:** auditoria — **nenhum código de produção foi alterado**. O único artefato é este documento.
**Método:** leitura de código e varredura de padrões, com verificação em execução onde era possível (formatação de moeda testada em Node, cobertura de módulos conferida no backend).

> **Nota de baseline.** A instrução desta auditoria assumia `fix/bugs-financeiro-auth` já mergeado. Essa branch **não existe** no remoto e o `master` está em `b8b77f3` (o fix de deploy). Os três bugs conhecidos — lançamentos, texto branco e erro genérico — **continuam em produção** e por isso aparecem aqui como achados, com a causa raiz diagnosticada.

---

## 1. Resumo Executivo

| Nível | Qtd |
|-------|-----|
| 🔴 QUEBRA | **3** |
| 🟠 INCONSISTÊNCIA | **4** |
| 🟡 UX | **3** |
| 🔵 CÓDIGO | **2** |

### Os 5 mais urgentes

1. **Admin não consegue excluir lançamento pago pela lista principal** — a tela nunca informa o perfil ao componente, que assume "não é admin". `QUEBRA-01`
2. **Texto invisível no tema claro** em Registro e Redefinir Senha — o input tem cor branca fixa. `QUEBRA-02`
3. **Erro real do backend é extraído e descartado uma linha depois**, em login e registro. `QUEBRA-03`
4. **Gaveta do menu abre sozinha no mobile** a cada carregamento — um booleano só serve dois significados opostos. `INC-02`
5. **Datas formatadas à mão em 28 lugares** contra 5 que usam o helper — o padrão existe e é ignorado. `INC-04`

### Precisa correção imediata?

**Sim — os três QUEBRA.** Todos são de baixo esforço (o maior é meio dia) e todos atingem fluxo de entrada ou operação financeira. `QUEBRA-02` e `QUEBRA-03` estão no cadastro: hoje quem tenta se registrar no tema claro digita às cegas e, se algo falhar, não descobre o motivo. É a pior combinação possível na porta de entrada do produto.

---

## 2. Achados por nível

### 🔴 QUEBRA

---

#### QUEBRA-01 — Admin bloqueado de excluir lançamento pago na lista principal

- **Nível:** 🔴 QUEBRA
- **Local:** `frontend/app/(dashboard)/financeiro/page.tsx:228-233`
- **Descrição:** Não é leitura de perfil desatualizada nem mensagem antiga disfarçada — é **prop ausente**.

  `LancamentoTable` recebe o perfil por prop, com default restritivo:

  ```tsx
  // components/financeiro/LancamentoTable.tsx:20,95
  isAdmin?: boolean;
  isAdmin = false,
  ```

  As duas telas que renderizam a tabela divergem:

  | | `/financeiro` (lista principal) | `/financeiro/lancamentos` ("ver tudo") |
  |---|---|---|
  | `useAuth` / cálculo de perfil | **ausente** | `isAdmin = usuario?.perfil === "admin"` (:46) |
  | prop `isAdmin` | **não passada → `false`** | passada (:262) |
  | `EditarPagoModal` / `ExcluirPagoModal` | **ausentes** | presentes (:339, :348) |
  | `onEditar` / `onHistorico` | **não passados** | passados |

  Como a prop nunca chega, o componente cai no default e exibe *"Só administradores podem excluir pagamentos"* (`LancamentoTable.tsx:305`) para **todo mundo, inclusive admin**.

  Agrava: mesmo passando a prop, a tela **não tem os modais de motivo/auditoria montados** — o fluxo correto não existiria ali. Ela usa `onDeletar={handleDeletar}`, exclusão direta sem trilha.
- **Correção recomendada:** Não passar a prop na tela principal e sim **eliminar a divergência**: extrair um componente que já traga `useAuth` + os dois modais + os handlers auditados, e usá-lo nas duas telas. Passar `isAdmin` isoladamente resolveria a mensagem mas deixaria a exclusão sem auditoria — meia correção, pior que nenhuma. Considerar também inverter o default da prop para exigir passagem explícita, para o próximo esquecimento falhar visivelmente.
- **Esforço:** Médio (meio dia, por causa da unificação).

---

#### QUEBRA-02 — Texto invisível no tema claro (Registro e Redefinir Senha)

- **Nível:** 🔴 QUEBRA
- **Local:** `frontend/app/(auth)/registro/page.tsx:115` · `frontend/app/(auth)/redefinir-senha/page.tsx:70`
- **Descrição:** É **cor hardcoded**, não tema faltando — o `ScriptTema` roda no layout raiz e alcança as rotas públicas normalmente.

  A classe do input fixa a cor do texto em branco:

  ```
  ...rounded-lg bg-card/60 border text-white placeholder-slate-500...
  ```

  No tema claro `bg-card` é claro, então o texto digitado fica branco sobre claro — invisível.

  **O relato original precisa de um ajuste:** o Login **não** está afetado (`login/page.tsx:102,130` já usa `text-foreground`, o token correto), e `recuperar-senha:110` também está correto. Quem está quebrado é **Registro** e **Redefinir Senha** — esta última não constava no relato.

  | Tela | Cor do input | Situação |
  |---|---|---|
  | Login | `text-foreground` | ✅ |
  | Recuperar Senha | `text-foreground` | ✅ |
  | **Registro** | `text-white` | ❌ |
  | **Redefinir Senha** | `text-white` | ❌ |

  Os demais `text-white` dessas telas (ícone do logo, texto de botão) estão sobre fundo de marca e são **legítimos** — não mexer.
- **Correção recomendada:** Trocar `text-white` por `text-foreground` nos dois `inputClass`. As telas devem seguir o tema (não fixar modo), que é o comportamento já correto das outras duas.
- **Esforço:** Trivial (duas linhas).

---

#### QUEBRA-03 — Mensagem de erro real é extraída e descartada

- **Nível:** 🔴 QUEBRA
- **Local:** `frontend/hooks/useAuth.ts:84,108` + `frontend/app/(auth)/login/page.tsx:48` e `registro/page.tsx:108`
- **Descrição:** O erro do backend **chega corretamente** e é jogado fora por dupla extração.

  1. O cliente HTTP lança o envelope da API intacto (`lib/api.ts:149` — `throw data as ApiError`), com `error.message` preenchido.
  2. O `useAuth` extrai a mensagem certa e **a embrulha num `Error` nativo**:
     ```ts
     // hooks/useAuth.ts:84 e :108
     throw new Error(getErrorMessage(error));
     ```
  3. A página chama `getErrorMessage` **de novo**, agora sobre um `Error` nativo:
     ```ts
     // login/page.tsx:48 · registro/page.tsx:108
     setServerError(getErrorMessage(err));
     ```
  4. E `getErrorMessage` só sabe ler o envelope:
     ```ts
     // lib/api.ts:204-208
     const e = error as ApiError;
     if (e?.error?.message) return e.error.message;
     return "Ocorreu um erro inesperado.";
     ```
     Um `Error` nativo não tem `.error` → **fallback genérico, sempre**.

  Ou seja: a mensagem correta existe no passo 2 e morre no passo 4. Vale para **todos** os erros dessas telas — credencial inválida, e-mail duplicado, senha fraca, 429 de rate limit (que o backend já devolve como `RATE_LIMIT_EXCEDIDO` com `retry_after_segundos`).
- **Correção recomendada:** Ensinar `getErrorMessage` a tratar `Error` nativo (`if (error instanceof Error) return error.message`) — corrige os dois pontos de uma vez e torna a função idempotente, imune a este erro no futuro. Alternativa: o `useAuth` repropagar o `ApiError` original em vez de embrulhar. Para 5xx sem corpo JSON, `response.json()` lança e o genérico continua aparecendo — vale um ramo próprio ("Erro no servidor, tente novamente").
  **Preservar o anti-enumeration:** a mensagem de credencial inválida já vem única do backend; a correção só a exibe, sem diferenciar e-mail inexistente de senha errada.
- **Esforço:** Baixo (uma função + teste).

---

### 🟠 INCONSISTÊNCIA

---

#### INC-01 — Duas telas de lançamentos com capacidades divergentes

- **Local:** `app/(dashboard)/financeiro/page.tsx` vs `app/(dashboard)/financeiro/lancamentos/page.tsx`
- **Descrição:** É a **raiz** do `QUEBRA-01` e merece registro próprio porque o risco sobrevive à correção pontual. As duas telas montam a mesma tabela com conjuntos diferentes de handlers e modais; qualquer regra nova de lançamento precisa ser lembrada duas vezes. Foi exatamente assim que a divergência atual nasceu.
- **Correção recomendada:** Um componente de seção de lançamentos que encapsule perfil, modais e handlers, consumido pelas duas rotas.
- **Esforço:** Médio.

---

#### INC-02 — Gaveta do menu abre sozinha no mobile

- **Local:** `frontend/store/useAppStore.ts:54` · `frontend/components/layout/Sidebar.tsx:94-113`
- **Descrição:** Confirmado. Um único booleano carrega **dois significados opostos**:

  ```ts
  sidebarOpen: true,   // store/useAppStore.ts:54
  ```

  - **Desktop:** `true` = sidebar expandida em 256px — é o default desejado.
  - **Mobile:** `true` = gaveta aberta **com overlay preto por cima do conteúdo** (`Sidebar.tsx:94`).

  Todo acesso pelo celular começa com o menu cobrindo a tela, exigindo um toque para revelar o conteúdo. Não é bug de CSS: é um estado com duas semânticas.
- **Correção recomendada:** Separar as responsabilidades — `sidebarExpandida` (desktop, default `true`) e `gavetaAberta` (mobile, default `false`) — ou inicializar por breakpoint. Evitar resolver com CSS, que só esconderia o sintoma.
- **Esforço:** Baixo.

---

#### INC-03 — `formatCurrency` duplicado, e a cópia é melhor que o original

- **Local:** `components/fornecedores/{ResumoCards,RankingFornecedores,HistoricoCompras,FornecedorTable}.tsx` e `app/(dashboard)/fornecedores/[id]/page.tsx:53` — 5 cópias.
- **Descrição:** O módulo de fornecedores reimplementa `formatCurrency` cinco vezes em vez de usar `lib/utils`. O detalhe interessante: **a cópia local é mais robusta que a canônica** — aceita string e devolve `"R$ 0,00"` para entrada inválida, enquanto a de `lib/utils` (`formatCurrency(value: number)`) devolveria `"R$ NaN"` (ver `COD-02`).
- **Correção recomendada:** Promover a versão robusta para `lib/utils` e apagar as cinco cópias — a consolidação corrige a fragilidade de quebra.
- **Esforço:** Baixo.

---

#### INC-04 — Datas formatadas à mão em 28 lugares

- **Local:** espalhado — `components/ai_hub/*`, `components/projetos/*`, entre outros.
- **Descrição:** `lib/utils` expõe `formatDate` e `formatDateTime`, mas só **5** arquivos os usam; **28** chamam `new Date(...).toLocaleDateString("pt-BR", {...})` direto, cada um com suas opções. Formatos divergem entre telas (uns com mês por extenso, outros numérico) e qualquer mudança de padrão exigiria 28 edições.
- **Correção recomendada:** Padronizar nos helpers, ampliando-os com as variantes realmente usadas (curta, longa, com hora).
- **Esforço:** Médio (mecânico, mas espalhado).

---

### 🟡 UX

---

#### UX-01 — Catch que descarta o erro do backend

- **Local:** `components/estoque/CategoriaEstoqueModal.tsx:82-84` · `app/(dashboard)/perfil/page.tsx:77-79`
- **Descrição:** Mesma família do `QUEBRA-03`, em outros dois pontos. Ambos usam `catch { }` **sem sequer capturar** o erro, e escrevem mensagem fixa:
  ```ts
  } catch {
    setErroGlobal("Erro ao salvar categoria. Tente novamente.");
  }
  ```
  O motivo real (categoria duplicada, validação de campo) nunca chega ao usuário. São os **únicos dois** casos remanescentes no sistema — a varredura não encontrou outros.
- **Correção recomendada:** Capturar o erro e usar o `getErrorMessage` já corrigido.
- **Esforço:** Trivial.

---

#### UX-02 — Login pode falhar em silêncio

- **Local:** `frontend/hooks/useAuth.ts:77-81`
- **Descrição:** O sucesso só age quando **as duas** condições valem:
  ```ts
  if (response.success && usuario) { ...redireciona... }
  ```
  Se a resposta vier `success: true` sem `usuario` no corpo, nada acontece: sem erro, sem redirecionamento, sem mensagem. O spinner encerra e a tela fica parada, sem explicação. Mesmo padrão no registro.
- **Correção recomendada:** Um `else` que sinalize resposta inesperada, em vez de retorno silencioso.
- **Esforço:** Trivial.

---

#### UX-03 — Placeholder com cor fixa nas telas de autenticação

- **Local:** as 4 telas de `app/(auth)/` — `placeholder-slate-500`
- **Descrição:** Diferente do `QUEBRA-02`, aqui a cor é legível nos dois modos (cinza médio), então não quebra. Mas é mais um valor fixo onde existe token, e o contraste no tema claro fica no limite do confortável.
- **Correção recomendada:** Trocar por `placeholder:text-muted-foreground` junto da correção do `QUEBRA-02`.
- **Esforço:** Trivial.

---

### 🔵 CÓDIGO

---

#### COD-01 — O linter não roda desde o Next 16

- **Local:** `frontend/package.json` → `"lint": "next lint"`
- **Descrição:** O Next 16 removeu o comando `next lint`; `pnpm lint` falha com *"Invalid project directory provided, no such directory: .../lint"*. Já estava quebrado antes das mudanças recentes.

  **O que deixou de ser verificado:** o `.eslintrc.json` estende `next/core-web-vitals` e `next/typescript` — ou seja, ficaram sem cobertura as regras de Core Web Vitals (uso indevido de `<img>` em vez de `next/image`, `<a>` no lugar de `<Link>`), as regras de hooks do React (dependências de `useEffect`, chamada condicional de hook) e as de acessibilidade do `jsx-a11y`. Nada disso é pego pelo `tsc`, que só verifica tipos. Vários achados deste relatório (valores fixos onde há token, imports não usados) são exatamente o tipo de coisa que um linter ativo sinalizaria.
- **Correção recomendada:** Migrar para ESLint 9 com flat config (`eslint.config.mjs`) e trocar o script para `eslint .`. Fecha de quebra os três CVEs dev-only registrados no `SECURITY_AUDIT.md` (`brace-expansion`, `glob`, `js-yaml`), que vêm justamente do ESLint 8.
- **Esforço:** Médio.

---

#### COD-02 — `formatCurrency` canônico é frágil e mente no tipo

- **Local:** `frontend/lib/utils.ts:11-16`
- **Descrição:** A assinatura é `formatCurrency(value: number)`, mas o backend serializa `DecimalField` do DRF como **string** — o tipo declarado não corresponde ao dado real. Verificado em execução:

  | Entrada | Saída |
  |---|---|
  | `1234.5` | `R$ 1.234,50` |
  | `"1234.50"` | `R$ 1.234,50` |
  | `null` / `""` | `R$ 0,00` |
  | `undefined` | **`R$ NaN`** |
  | `NaN` / `"abc"` | **`R$ NaN`** |

  Hoje **não há quebra ativa**: os três call sites com valor opcional já se protegem com `?? "0"` (`clientes/ResumoCards.tsx:125`, `fornecedores/ResumoCards.tsx:82,90`). É risco latente — o primeiro campo opcional que escapar mostra `R$ NaN` ao usuário.
- **Correção recomendada:** Adotar a versão robusta do módulo de fornecedores (aceita `string | number`, trata `NaN`) como canônica — resolve junto o `INC-03`.
- **Esforço:** Baixo.

---

## 3. Padrões recorrentes

Três achados isolados, mas **um mesmo hábito** — vale corrigir como padrão, não caso a caso:

1. **Erro do backend descartado** (`QUEBRA-03`, `UX-01`) — 4 pontos no total. A correção certa é uma só: tornar `getErrorMessage` idempotente e capaz de ler `Error` nativo. Feito isso, os quatro pontos passam a funcionar sem edição individual.
2. **Valor fixo onde existe token de tema** (`QUEBRA-02`, `UX-03`) — o design system tem os tokens; o que falta é o linter que apontaria o desvio (`COD-01`). Enquanto o lint não voltar, isso reaparece.
3. **Helper existe e é ignorado** (`INC-03`, `INC-04`, `COD-02`) — moeda e data têm helper em `lib/utils`, mas 5 e 28 lugares, respectivamente, reimplementam. Em moeda a reimplementação ficou **melhor** que o original, o que é o sinal mais claro de que o canônico não estava bom o bastante para ser adotado.

O fio comum: **o padrão existe, mas nada obriga a segui-lo.** Restaurar o lint (`COD-01`) é o que mais reduz reincidência.

---

## 4. O que está bem

Boa parte do que se auditou está sólida — vale saber onde não mexer:

- ✅ **Módulos desligados são respeitados no backend, na camada certa.** `modules/search/views.py:96-114` filtra cada tipo por `modulo_ativo`, e a chave de cache inclui um **fingerprint dos módulos** (`:47-48`) — então ligar/desligar um módulo não serve resultado obsoleto. O `BuscaGlobal` do frontend não precisa saber de módulos, e não sabe: a responsabilidade está num lugar só.
- ✅ **Toda ação destrutiva tem confirmação.** Os 20 arquivos com handler de exclusão passam por `ConfirmDialog` ou modal dedicado — nenhum exclui direto.
- ✅ **Tabelas principais tratam vazio e carregamento.** `LancamentoTable`, `ProdutoTable`, `FornecedorTable` e `ClienteTable` têm os dois estados.
- ✅ **Nenhum `console.log` esquecido** em `components/`, `app/`, `hooks/` e `lib/`.
- ✅ **Nenhum TODO ou FIXME pendente** — os matches de "TODOS" são a palavra em português.
- ✅ **Nenhum catch silencioso** (bloco vazio) fora dos dois de `UX-01`, que ao menos avisam o usuário.
- ✅ **Fluxo auditado do financeiro é bem construído** onde está montado: editar/excluir pago exige admin **e** motivo, com log — o problema do `QUEBRA-01` é ele não estar presente na outra tela, não o fluxo em si.
- ✅ **Larguras fixas em geral são responsivas** — o padrão `w-full sm:w-[180px]` predomina; a moldura em px do sidebar é intencional (não escala com o tamanho do texto, conforme comentado no código).

---

## 5. Sugestão de ordem

1. `QUEBRA-02` e `UX-03` — duas linhas, destravam o cadastro no tema claro.
2. `QUEBRA-03` + `UX-01` — uma função, resolve os 4 pontos de erro engolido.
3. `QUEBRA-01` + `INC-01` — junto, para não fazer meia correção.
4. `INC-02` — gaveta mobile.
5. `COD-02` + `INC-03` — consolidar moeda.
6. `COD-01` — restaurar o lint, o que segura a reincidência dos itens 1 e 5.
7. `INC-04` — datas, mecânico, pode vir por último.

---

*Auditoria por leitura de código com verificação em execução onde aplicável. Nenhum código de produção foi modificado nesta branch.*

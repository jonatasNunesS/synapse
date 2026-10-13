/**
 * Guarda: nenhum `} catch {` novo pode engolir o erro do backend.
 *
 * Esta guarda existe porque o padrão já voltou. O QUALITY_AUDIT declarou o
 * problema resolvido dizendo que "só restam 2"; a auditoria seguinte contou
 * 30. Duas vezes alguém consertou os sítios e ninguém trancou a porta, e a
 * terceira rodada de correção manual seria só mais uma rodada.
 *
 * O QUE ELA PROÍBE
 *
 * `} catch {` sem binding descarta o erro no próprio ponto onde ele chegou.
 * Depois disso não há mais o que fazer: a mensagem que o backend escreveu
 * ("O módulo Estoque está desligado para esta empresa", "Lead não pode ir
 * direto para Fechado") deixou de existir, e o que sobra é a frase genérica
 * que quem escreveu o catch imaginou na hora. `getErrorMessage` já sabe tirar
 * a mensagem do envelope — o que faltava era alguém guardar o erro para
 * entregá-lo a ela.
 *
 * O ESCOPO É MAIOR QUE `hooks/`
 *
 * De propósito. Dos 30 sítios da Leva 4, nove estavam fora de `hooks/` — em
 * `components/`, inclusive um que dizia "Senha de staff incorreta" para
 * qualquer falha de rede. Uma guarda que olhasse só os hooks deixaria o mesmo
 * defeito entrar pela porta ao lado.
 *
 * QUANDO O CATCH É LEGÍTIMO
 *
 * Há casos em que não existe mensagem de backend para mostrar: ler
 * `localStorage` numa aba privada, a área de transferência recusar, o próprio
 * `lib/api.ts` convertendo falha de rede em envelope. Esses estão na
 * allowlist abaixo, cada um com a razão escrita. A allowlist guarda a
 * QUANTIDADE esperada por arquivo, não a linha: linha muda a cada edição, e
 * um arquivo que já tem um catch legítimo não fica por isso liberado para
 * receber um segundo sem ninguém olhar.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const DIRS = ["app", "components", "hooks", "lib", "store"];
const IGNORE = new Set(["node_modules", ".next", "dist"]);

/** `} catch {` e `}catch{`, com ou sem espaços, mas sem parâmetro. */
const CATCH_SEM_BINDING = /\}\s*catch\s*\{/g;

interface Permitido {
  /** Quantos catches sem binding este arquivo pode ter. */
  quantos: number;
  /** Por que não há mensagem de backend a mostrar aqui. */
  porque: string;
}

const ALLOWLIST: Record<string, Permitido> = {
  "lib/api.ts": {
    quantos: 2,
    porque:
      "É o conversor. Um catch pega a rede fora do ar (o fetch rejeita com " +
      '"Failed to fetch", técnico e em inglês) e o outro, corpo que não é ' +
      "JSON (5xx que devolveu HTML de gateway). Os dois transformam isso no " +
      "envelope que o resto do sistema lê — são a origem da mensagem, não " +
      "um lugar que a perde.",
  },
  "lib/chatHistory.ts": {
    quantos: 1,
    porque:
      "Leitura de localStorage. Aba privada e site data bloqueado fazem o " +
      "acessor lançar, e não há backend envolvido.",
  },
  "hooks/useChatHistory.ts": {
    quantos: 1,
    porque:
      "`getStorage()`: o mero acesso a `window.localStorage` lança em alguns " +
      "contextos. Mesma categoria do anterior.",
  },
  "hooks/useBuscaVinculo.ts": {
    quantos: 1,
    porque:
      "Silencioso por decisão de produto (PR #54): o vínculo a projeto ou " +
      "venda é opcional, e um toast por não conseguir listar projetos " +
      "atrapalharia quem só quer salvar o compromisso.",
  },
  "hooks/useAuth.ts": {
    quantos: 3,
    porque:
      "Os três são o caminho normal da sessão, não falha. `carregarUsuario`: " +
      "401 na abertura do app é quem não está logado. `logout`: o estado " +
      "local é limpo de qualquer forma, e avisar que o logout falhou enquanto " +
      "o usuário já está sendo levado para /login é ruído. " +
      "`refreshSilencioso`: o nome diz — token expirado é rotina, e toda " +
      "sessão passaria por um toast.",
  },
  "hooks/useVendas.ts": {
    quantos: 1,
    porque:
      "`useVendasDoCliente`: na falha mostra lista vazia. ISTO É A FORMA DO " +
      "ERR-04 (falha com cara de 'não tem nada'), e está aqui porque " +
      "consertá-lo é trabalho de exibição — o hook não tem estado de erro e " +
      "o perfil do cliente não tem onde mostrar 'indisponível'. Fica " +
      "registrado para uma leva de UI, não esquecido.",
  },
  "components/painel_admin/UsuariosSection.tsx": {
    quantos: 1,
    porque:
      "A área de transferência recusou a escrita. O navegador não manda " +
      "mensagem aproveitável, e o backend não participa.",
  },
  "components/recorrencias/AvisoMigracao.tsx": {
    quantos: 1,
    porque:
      "Marcar o aviso como visto. Se falhar, o aviso reaparece no próximo " +
      "login — consequência aceitável e preferível a um toast de erro sobre " +
      "um aviso.",
  },
  "components/agenda/CategoriaEventoModal.tsx": {
    quantos: 1,
    porque:
      "É a METADE CERTA do padrão, não o defeito: o hook propaga, o " +
      "componente engole aqui porque renderiza `error` do hook logo abaixo " +
      "(`{error && ...}`). Quem chama um loader que propaga precisa escutar " +
      "a rejeição em algum lugar.",
  },
  "components/financeiro/LancamentoTable.tsx": {
    quantos: 1,
    porque:
      "`formatarData`: o `parseISO` não entendeu a string e o fallback é " +
      "mostrar a string crua. Falha de formatação, sem backend no caminho.",
  },
};

function varrer(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (IGNORE.has(nome)) continue;
    const full = join(dir, nome);
    if (statSync(full).isDirectory()) {
      varrer(full, acc);
    } else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.(ts|tsx)$/.test(nome)) {
      acc.push(full);
    }
  }
  return acc;
}

function contar(texto: string): number {
  return texto.match(CATCH_SEM_BINDING)?.length ?? 0;
}

/** Arquivo → quantos catches sem binding ele tem hoje. */
function levantamento(): Map<string, number> {
  const achados = new Map<string, number>();
  for (const dir of DIRS) {
    for (const f of varrer(join(ROOT, dir))) {
      const n = contar(readFileSync(f, "utf8"));
      if (n > 0) {
        achados.set(f.slice(ROOT.length + 1).replace(/\\/g, "/"), n);
      }
    }
  }
  return achados;
}

const COMO_CORRIGIR =
  "\n\n  catch sem binding engole o erro do backend." +
  "\n  Use `catch (err)` e entregue o erro a quem possa mostrá-lo:" +
  "\n" +
  "\n      } catch (err) {" +
  "\n        setError(getErrorMessage(err));" +
  "\n        throw err;" +
  "\n      }" +
  "\n" +
  "\n  E ligue um ouvinte em quem chama — `avisarSeFalhar(carregar())` de" +
  "\n  `@/lib/avisarErro`, ou um try/catch que mostre a mensagem. Propagar" +
  "\n  para ninguém é o mesmo silêncio por outro caminho." +
  "\n" +
  "\n  Se for intencional (localStorage, clipboard, caminho normal da" +
  "\n  sessão), acrescente o arquivo à ALLOWLIST em" +
  "\n  lib/catch-sem-binding.test.ts, com a razão escrita.\n";

describe("catch sem binding", () => {
  it("nenhum arquivo fora da allowlist engole o erro", () => {
    const achados = levantamento();
    const ofensores = [...achados.entries()]
      .filter(([arquivo]) => !(arquivo in ALLOWLIST))
      .map(([arquivo, n]) => `${arquivo} (${n})`)
      .sort();

    expect(ofensores, COMO_CORRIGIR).toEqual([]);
  });

  it("arquivo da allowlist não ganha catches novos de carona", () => {
    const achados = levantamento();
    const excedentes = [...achados.entries()]
      .filter(([arquivo, n]) => arquivo in ALLOWLIST && n > ALLOWLIST[arquivo].quantos)
      .map(
        ([arquivo, n]) =>
          `${arquivo}: ${n} catches, allowlist permite ${ALLOWLIST[arquivo].quantos}`
      )
      .sort();

    expect(
      excedentes,
      "Um catch legítimo no arquivo não libera os próximos." + COMO_CORRIGIR
    ).toEqual([]);
  });

  it("a allowlist não guarda entrada que já não descreve o código", () => {
    // Entrada obsoleta é pior que entrada faltando: ela afirma que um catch
    // engolido ali é intencional, e a afirmação sobrevive ao catch.
    const achados = levantamento();
    const obsoletas = Object.keys(ALLOWLIST)
      .filter((arquivo) => (achados.get(arquivo) ?? 0) < ALLOWLIST[arquivo].quantos)
      .sort();

    expect(
      obsoletas,
      "Estes arquivos têm MENOS catches do que a allowlist declara — " +
        "ajuste `quantos` ou remova a entrada."
    ).toEqual([]);
  });

  it("toda entrada da allowlist explica a razão", () => {
    // Sem isto a allowlist viraria uma lista de arquivos, e uma lista de
    // arquivos não distingue decisão de desistência.
    for (const [arquivo, { porque, quantos }] of Object.entries(ALLOWLIST)) {
      expect(quantos, `${arquivo}: quantos`).toBeGreaterThan(0);
      expect(porque.length, `${arquivo}: razão muito curta`).toBeGreaterThan(40);
    }
  });
});

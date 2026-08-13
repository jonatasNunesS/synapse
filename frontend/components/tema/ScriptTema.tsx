/**
 * Anti-flash da aparência: identidade visual da empresa (paleta + fonte) e
 * preferências do usuário (tamanho do texto + modo claro/escuro).
 *
 * Todas chegam no /auth/me — que só responde depois que o React montou. Se
 * fossem aplicadas aí, o usuário veria as cores padrão por um instante, e a
 * página trocaria na frente dele. No modo claro isso é pior ainda: um flash
 * de tela preta antes do branco.
 *
 * Este script roda ANTES do primeiro paint: lê os cookies gravados no último
 * carregamento e escreve `data-tema` / `data-fonte` / `data-fonte-tamanho` /
 * `data-modo` no <html>, então o CSS já vale no primeiro pixel desenhado.
 * Quando o /auth/me responde, o useAuth reescreve os mesmos atributos —
 * normalmente com o mesmo valor, sem nada piscando.
 *
 * O modo tem um passo a mais: se o valor guardado for "sistema" (ou não
 * houver cookie nenhum), ele consulta o prefers-color-scheme aqui mesmo,
 * ainda antes do paint.
 *
 * Fica inline (não é um módulo carregado depois) justamente para ser síncrono.
 */
import {
  CONSULTA_SO,
  COOKIE_MODO,
  COOKIE_TAMANHO,
  TAMANHOS_VALIDOS,
} from "@/lib/preferencias";
import { COOKIE_TEMA, FONTES_VALIDAS, PALETAS_VALIDAS } from "@/lib/tema";

const SCRIPT = `
(function(){
  var el = document.documentElement;
  function cookie(nome) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + nome + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  try {
    var tema = cookie("${COOKIE_TEMA}");
    if (tema) {
      var partes = tema.split(".");
      if (${JSON.stringify(PALETAS_VALIDAS)}.indexOf(partes[0]) > -1) el.dataset.tema = partes[0];
      if (${JSON.stringify(FONTES_VALIDAS)}.indexOf(partes[1]) > -1) el.dataset.fonte = partes[1];
    }
  } catch (e) {
    /* sem tema salvo: fica o padrão Synapse */
  }
  try {
    var tamanho = cookie("${COOKIE_TAMANHO}");
    if (tamanho && ${JSON.stringify(TAMANHOS_VALIDOS)}.indexOf(tamanho) > -1) {
      el.dataset.fonteTamanho = tamanho;
    }
  } catch (e) {
    /* sem preferência salva: fica o tamanho normal */
  }
  try {
    var modo = cookie("${COOKIE_MODO}");
    if (modo !== "claro" && modo !== "escuro") {
      // "sistema", cookie ausente ou valor adulterado: pergunta ao SO. Se
      // nem isso responder, fica escuro — o visual de sempre.
      modo = window.matchMedia && window.matchMedia("${CONSULTA_SO}").matches
        ? "escuro"
        : (window.matchMedia ? "claro" : "escuro");
    }
    el.dataset.modo = modo;
    if (modo === "escuro") el.classList.add("dark");
    else el.classList.remove("dark");
  } catch (e) {
    el.dataset.modo = "escuro";
    el.classList.add("dark");
  }
})();
`.trim();

export function ScriptTema() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

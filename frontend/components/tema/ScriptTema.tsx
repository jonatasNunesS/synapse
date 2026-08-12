/**
 * Anti-flash da aparência (identidade visual da empresa + tamanho do texto
 * do usuário).
 *
 * As duas configurações chegam no /auth/me — que só responde depois que o
 * React montou. Se fossem aplicadas aí, o usuário veria as cores padrão (e o
 * texto pequeno) por um instante, e a página trocaria na frente dele.
 *
 * Este script roda ANTES do primeiro paint: lê os cookies gravados no último
 * carregamento e escreve `data-tema` / `data-fonte` / `data-fonte-tamanho` no
 * <html>, então o CSS já vale no primeiro pixel desenhado. Quando o /auth/me
 * responde, o useAuth reescreve os mesmos atributos — normalmente com o mesmo
 * valor, sem nada piscando.
 *
 * Fica inline (não é um módulo carregado depois) justamente para ser síncrono.
 */
import { COOKIE_TAMANHO, TAMANHOS_VALIDOS } from "@/lib/preferencias";
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
})();
`.trim();

export function ScriptTema() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

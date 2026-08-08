/**
 * Anti-flash da identidade visual.
 *
 * O tema é da EMPRESA e chega no /auth/me — que só responde depois que o
 * React montou. Se as cores fossem aplicadas aí, o usuário veria o roxo padrão
 * por um instante e a página trocaria de cor na frente dele.
 *
 * Este script roda ANTES do primeiro paint: lê o cookie gravado no último
 * carregamento e escreve `data-tema`/`data-fonte` no <html>, então o CSS das
 * paletas já vale no primeiro pixel desenhado. Quando o /auth/me responde, o
 * useAuth reescreve os mesmos atributos — normalmente com o mesmo valor, sem
 * nada piscando.
 *
 * Fica inline (não é um módulo carregado depois) justamente para ser síncrono.
 */
import { COOKIE_TEMA, FONTES_VALIDAS, PALETAS_VALIDAS } from "@/lib/tema";

const SCRIPT = `
(function(){
  try {
    var paletas = ${JSON.stringify(PALETAS_VALIDAS)};
    var fontes = ${JSON.stringify(FONTES_VALIDAS)};
    var m = document.cookie.match(/(?:^|; )${COOKIE_TEMA}=([^;]*)/);
    if (!m) return;
    var partes = decodeURIComponent(m[1]).split(".");
    var el = document.documentElement;
    if (paletas.indexOf(partes[0]) > -1) el.dataset.tema = partes[0];
    if (fontes.indexOf(partes[1]) > -1) el.dataset.fonte = partes[1];
  } catch (e) {
    /* sem tema salvo: fica o padrão Synapse */
  }
})();
`.trim();

export function ScriptTema() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

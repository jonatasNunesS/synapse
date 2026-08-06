"use client";
/**
 * Landing — 7/10: prova (depoimento em aberto + números de bastidor).
 * No original a seção inteira era condicional (`sc-if mostrarProva`); aqui a
 * condição virou prop, ligada por padrão.
 */
import { s } from "./css";

const LINHA =
  "padding:16px 0;border-bottom:1px solid rgba(24,24,27,.12);display:flex;gap:16px;align-items:baseline";
const NUMERO =
  "font-family:'IBM Plex Mono',monospace;font-size:14px;color:#6D28D9;min-width:56px";
const DESCRICAO = "font-size:14.5px;line-height:1.55;color:#3F3F46";

const NUMEROS = [
  { valor: "850+", texto: "testes automáticos rodam a cada mudança no sistema" },
  {
    valor: "3",
    texto:
      "verificações separadas garantem que uma empresa nunca veja os dados de outra",
  },
  {
    valor: "0",
    texto:
      "senhas guardadas no código, e a sessão fica fora do alcance de scripts no navegador",
  },
  {
    valor: "∅",
    texto:
      "movimentações de estoque apagadas: a correção entra como novo lançamento",
  },
];

export function ProvaSection() {
  return (
    <section style={s("border-top:1px solid rgba(24,24,27,.09)")}>
      <div
        style={s(
          "max-width:1180px;margin:0 auto;padding:clamp(64px,11vw,140px) clamp(18px,4vw,36px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:clamp(28px,5vw,64px);align-items:start"
        )}
      >
        <div>
          <h2
            data-reveal
            style={s(
              "font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(26px,4.4vw,38px);line-height:1.12;letter-spacing:-.01em;max-width:20ch;text-wrap:pretty"
            )}
          >
            Dois negócios usam o Synapse todos os dias
          </h2>
          <p
            data-reveal
            style={s(
              "margin-top:16px;font-size:16px;line-height:1.6;color:#52525B;max-width:46ch;text-wrap:pretty"
            )}
          >
            Uma assessoria de cerimonial e uma marca de roupa acompanham o
            sistema desde a primeira versão. Uma vende serviço a prazo, a outra
            controla produto e fornecedor, e o Synapse foi ajustado para os dois
            casos.
          </p>
          <figure
            data-reveal
            style={s(
              "margin-top:clamp(24px,3.5vw,32px);border:1px dashed rgba(24,24,27,.25);border-radius:12px;padding:clamp(18px,2.6vw,26px);background:repeating-linear-gradient(135deg,rgba(24,24,27,.028) 0 8px,transparent 8px 16px)"
            )}
          >
            <p
              style={s(
                "font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:#71717A"
              )}
            >
              Depoimento · aguardando nome e frase
            </p>
            <blockquote
              style={s(
                "margin-top:14px;font-family:'Instrument Serif',Georgia,serif;font-size:clamp(18px,2.6vw,22px);line-height:1.35;color:#A1A1AA"
              )}
            >
              “A frase do cliente entra aqui. Funciona melhor com um número:
              tempo economizado por semana, ou quanto parou de perder em cobrança
              atrasada.”
            </blockquote>
            <p style={s("margin-top:14px;font-size:13px;color:#71717A")}>
              Nome · segmento · cidade
            </p>
          </figure>
        </div>
        <div data-reveal>
          <p
            style={s(
              "font-family:'IBM Plex Mono',monospace;font-size:11.5px;letter-spacing:.11em;text-transform:uppercase;color:#71717A"
            )}
          >
            Por dentro
          </p>
          <ul
            style={s(
              "margin-top:20px;display:grid;gap:0;border-top:1px solid rgba(24,24,27,.12)"
            )}
          >
            {NUMEROS.map((item) => (
              <li key={item.texto} style={s(LINHA)}>
                <span style={s(NUMERO)}>{item.valor}</span>
                <span style={s(DESCRICAO)}>{item.texto}</span>
              </li>
            ))}
          </ul>
          <p
            style={s(
              "margin-top:20px;font-size:14px;line-height:1.6;color:#71717A;max-width:46ch;text-wrap:pretty"
            )}
          >
            Alterar um lançamento já pago exige informar o motivo, e o sistema
            guarda como o valor estava antes. Serve para você conferir depois,
            com um sócio ou com o contador.
          </p>
        </div>
      </div>
    </section>
  );
}

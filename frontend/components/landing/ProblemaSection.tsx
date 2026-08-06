"use client";
/** Landing — 2/10: as situações que o visitante reconhece. */
import { s } from "./css";

const ITEM =
  "border-bottom:1px solid rgba(24,24,27,.12);padding:clamp(22px,3vw,30px) clamp(20px,2.5vw,28px) clamp(22px,3vw,30px) 0;display:flex;gap:16px;align-items:flex-start";

const SITUACOES = [
  "A venda saiu, mas a planilha de estoque ficou igual.",
  "Um cliente combinou de pagar dia 10 e ninguém lembrou de cobrar.",
  "A compra do fornecedor foi feita, mas não entrou nas despesas.",
  "Chegou o fim do mês e não dá para dizer se sobrou dinheiro.",
];

export function ProblemaSection() {
  return (
    <section style={s("border-top:1px solid rgba(24,24,27,.09);background:#F5F5F3")}>
      <div
        style={s(
          "max-width:1180px;margin:0 auto;padding:clamp(64px,11vw,140px) clamp(18px,4vw,36px)"
        )}
      >
        <h2
          data-reveal
          style={s(
            "font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(28px,5vw,44px);line-height:1.1;letter-spacing:-.01em;max-width:24ch;text-wrap:pretty"
          )}
        >
          Onde a conta costuma não fechar
        </h2>
        <ol
          data-reveal
          style={s(
            "margin:clamp(32px,5vw,52px) 0 0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:0;border-top:1px solid rgba(24,24,27,.12)"
          )}
        >
          {SITUACOES.map((texto, i) => (
            <li key={texto} style={s(ITEM)}>
              <span
                style={s(
                  "font-family:'IBM Plex Mono',monospace;font-size:11px;color:#A1A1AA;padding-top:5px"
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <p
                style={s(
                  "font-size:clamp(17px,2.4vw,20px);line-height:1.4;color:#27272A;text-wrap:pretty"
                )}
              >
                {texto}
              </p>
            </li>
          ))}
        </ol>
        <p
          data-reveal
          style={s(
            "margin-top:clamp(32px,5vw,52px);font-size:clamp(19px,2.8vw,24px);line-height:1.45;max-width:44ch;color:#18181B;text-wrap:pretty;border-left:2px solid #6D28D9;padding-left:clamp(16px,2.4vw,22px)"
          )}
        >
          Você anota tudo. O trabalho dobrado vem de anotar nos lugares errados,
          cada um sem saber do outro.
        </p>
      </div>
    </section>
  );
}

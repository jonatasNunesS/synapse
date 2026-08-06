"use client";
/**
 * Landing — 9/10: perguntas frequentes.
 * Mantém <details>/<summary> nativos (acessível, abre sem JS) com o marcador
 * padrão escondido pelo CSS module, como no original.
 */
import { s } from "./css";

const ITEM = "border-bottom:1px solid rgba(24,24,27,.12)";
const RESUMO =
  "display:flex;gap:14px;align-items:baseline;justify-content:space-between;padding:18px 0;font-size:16.5px;font-weight:500;line-height:1.4";
const MAIS = "font-family:'IBM Plex Mono',monospace;color:#A1A1AA;font-size:15px";
const RESPOSTA =
  "padding:0 0 20px;font-size:15px;line-height:1.65;color:#52525B;max-width:58ch;text-wrap:pretty";

const PERGUNTAS = [
  {
    pergunta: "É mais um sistema complicado?",
    resposta:
      "O cadastro tem três etapas e já sai configurado. Na primeira vez que você entra, o menu mostra só o que você respondeu que usa, então não há onze telas para descobrir sozinho.",
  },
  {
    pergunta: "Já uso planilha e funciona.",
    resposta:
      "A planilha continua útil. O que ela não faz é avisar que um cliente paga hoje, dar baixa no estoque quando você vende e mostrar que a margem caiu de um mês para o outro. É esse trabalho que o sistema assume.",
  },
  {
    pergunta: "IA não é só enfeite?",
    resposta:
      "A do Synapse não escreve texto solto: ela olha a sua receita, a sua despesa e as suas cobranças atrasadas para responder sobre o seu negócio. Sem lançamentos no sistema, ela avisa que não tem dados em vez de inventar.",
  },
  {
    pergunta: "E se eu precisar de um módulo que desliguei?",
    resposta:
      "Você liga de novo nas Configurações, na hora, sem pedir para ninguém. Nada foi apagado enquanto o módulo estava desligado.",
  },
  {
    pergunta: "Consigo trazer o que já tenho na planilha?",
    resposta:
      "Sim. Clientes, produtos e contas em aberto entram de uma vez; mande a planilha no WhatsApp que ajudamos a organizar o formato. O histórico antigo é opcional: dá para começar do saldo de hoje.",
  },
  {
    pergunta: "E se eu quiser cancelar?",
    resposta:
      "O cancelamento é feito no próprio sistema, sem ligação de retenção. Você exporta o que precisa antes de sair, e os dados não são apagados de um dia para o outro.",
  },
  {
    pergunta: "Como funciona o suporte?",
    resposta:
      "Pelo WhatsApp, incluído nos três planos. Quem responde é a equipe que desenvolve o Synapse e usa o sistema no dia a dia.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" style={s("border-top:1px solid rgba(24,24,27,.09)")}>
      <div
        style={s(
          "max-width:1180px;margin:0 auto;padding:clamp(64px,11vw,140px) clamp(18px,4vw,36px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:clamp(24px,4vw,56px);align-items:start"
        )}
      >
        <div>
          <h2
            data-reveal
            style={s(
              "font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(28px,5vw,42px);line-height:1.1;letter-spacing:-.01em;max-width:16ch;text-wrap:pretty"
            )}
          >
            Perguntas frequentes
          </h2>
          <p
            data-reveal
            style={s(
              "margin-top:16px;font-size:14.5px;line-height:1.6;color:#71717A;max-width:34ch;text-wrap:pretty"
            )}
          >
            Ficou alguma dúvida de fora? Chame no WhatsApp, a resposta vem de
            quem fez o sistema.
          </p>
        </div>
        <div data-reveal style={s("border-top:1px solid rgba(24,24,27,.12)")}>
          {PERGUNTAS.map((item) => (
            <details key={item.pergunta} style={s(ITEM)}>
              <summary style={s(RESUMO)}>
                <span>{item.pergunta}</span>
                <span aria-hidden="true" style={s(MAIS)}>
                  +
                </span>
              </summary>
              <p style={s(RESPOSTA)}>{item.resposta}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

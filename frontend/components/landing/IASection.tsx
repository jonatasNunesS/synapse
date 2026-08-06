"use client";
/** Landing — 5/10: a análise financeira que a IA escreve. */
import { s } from "./css";

const MINI_CARTAO = "border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:11px 12px";
const MINI_ROTULO = "font-size:11px;color:#A1A1AA";
const MINI_VALOR =
  "font-family:'IBM Plex Mono',monospace;font-size:14px;color:#F4F4F5;margin-top:5px";
const ETAPA = "display:flex;gap:11px;align-items:flex-start";
const ETAPA_NUM =
  "font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:#A1A1AA;padding-top:3px";
const ETAPA_TEXTO = "font-size:14px;line-height:1.55;color:#3F3F46";
const RECOMENDACAO =
  "font-size:13.5px;line-height:1.55;color:#A1A1AA;display:flex;gap:9px";

const ETAPAS = [
  "O sistema calcula receita, despesa, margem e atrasos do período.",
  "Esses valores são enviados para a IA junto com o mês anterior.",
  "A IA escreve a análise em português. Sem dados lançados, ela avisa que não tem o que analisar.",
];

const RECOMENDACOES = [
  "Ao planejar agosto, não conte com a economia dos R$ 890,00 de material gráfico: ela foi pontual.",
  "Vale conversar sobre prazo com o fornecedor de maior volume, que responde por metade da despesa.",
];

export function IASection() {
  return (
    <section id="ia" style={s("border-top:1px solid rgba(24,24,27,.09)")}>
      <div
        style={s(
          "max-width:1180px;margin:0 auto;padding:clamp(64px,11vw,150px) clamp(18px,4vw,36px)"
        )}
      >
        <p
          data-reveal
          style={s(
            "font-family:'IBM Plex Mono',monospace;font-size:11.5px;letter-spacing:.11em;text-transform:uppercase;color:#71717A"
          )}
        >
          Inteligência artificial
        </p>
        <h2
          data-reveal
          style={s(
            "margin-top:18px;font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(28px,5vw,46px);line-height:1.1;letter-spacing:-.01em;max-width:24ch;text-wrap:pretty"
          )}
        >
          A inteligência artificial trabalha com os seus dados
        </h2>
        <p
          data-reveal
          style={s(
            "margin-top:18px;font-size:clamp(16px,2.2vw,17.5px);line-height:1.6;color:#52525B;max-width:60ch;text-wrap:pretty"
          )}
        >
          Quem faz as contas é o sistema. A IA recebe os valores já calculados e
          escreve a leitura deles, então os números que aparecem na análise são
          os mesmos do seu financeiro.
        </p>

        <div
          data-reveal
          style={s(
            "margin-top:clamp(32px,5vw,56px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:clamp(14px,2vw,20px);align-items:start"
          )}
        >
          {/* Cartão escuro: a análise gerada */}
          <div
            style={s(
              "background:#09090D;border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:clamp(16px,2.4vw,24px);box-shadow:0 20px 40px -28px rgba(9,9,13,.45)"
            )}
          >
            <div
              style={s(
                "display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.07)"
              )}
            >
              <span
                style={s(
                  "font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#A1A1AA"
                )}
              >
                Análise financeira · julho vs. junho
              </span>
              <span
                style={s(
                  "font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:#C4B5FD"
                )}
              >
                −2 créditos
              </span>
            </div>
            <div
              style={s(
                "display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:16px"
              )}
            >
              <div style={s(MINI_CARTAO)}>
                <p style={s(MINI_ROTULO)}>Receita</p>
                <p style={s(MINI_VALOR)}>R$ 5.087,25</p>
              </div>
              <div style={s(MINI_CARTAO)}>
                <p style={s(MINI_ROTULO)}>Despesa</p>
                <p style={s(MINI_VALOR)}>R$ 2.286,33</p>
              </div>
              <div style={s(MINI_CARTAO)}>
                <p style={s(MINI_ROTULO)}>Margem</p>
                <p style={s(MINI_VALOR.replace("#F4F4F5", "#4ADE80"))}>55,1%</p>
              </div>
            </div>
            <div style={s("margin-top:16px;display:grid;gap:13px")}>
              <p
                style={s(
                  "font-size:14px;line-height:1.65;color:#E4E4E7;text-wrap:pretty"
                )}
              >
                Julho terminou com{" "}
                <span
                  style={s("font-family:'IBM Plex Mono',monospace;color:#4ADE80")}
                >
                  +R$ 2.800,92
                </span>
                , contra{" "}
                <span
                  style={s("font-family:'IBM Plex Mono',monospace;color:#F4F4F5")}
                >
                  +R$ 1.210,00
                </span>{" "}
                em junho. A margem passou de 29,4% para 55,1%, mas parte disso é
                despesa que não voltou: <span style={s("color:#F4F4F5")}>R$ 890,00</span>{" "}
                de material gráfico só apareceram em junho.
              </p>
              <p
                style={s(
                  "font-size:14px;line-height:1.65;color:#E4E4E7;text-wrap:pretty"
                )}
              >
                A maior despesa continua sendo fornecedores,{" "}
                <span
                  style={s("font-family:'IBM Plex Mono',monospace;color:#F4F4F5")}
                >
                  R$ 1.240,00
                </span>{" "}
                no mês, 54% do total. O valor médio por venda caiu de R$ 291,00
                para R$ 264,00: mais vendas, cada uma menor.
              </p>
              <div
                style={s("border-top:1px solid rgba(255,255,255,.07);padding-top:13px")}
              >
                <p
                  style={s(
                    "font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#A1A1AA;margin-bottom:9px"
                  )}
                >
                  Recomendações
                </p>
                <ul style={s("display:grid;gap:8px")}>
                  {RECOMENDACOES.map((texto) => (
                    <li key={texto} style={s(RECOMENDACAO)}>
                      <span style={s("color:#6D28D9")}>—</span>
                      <span>{texto}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p
              style={s(
                "margin-top:16px;padding-top:13px;border-top:1px solid rgba(255,255,255,.07);font-family:'IBM Plex Mono',monospace;font-size:10.5px;line-height:1.6;color:#71717A"
              )}
            >
              exemplo de análise · números vindos do financeiro
            </p>
          </div>

          {/* Coluna clara: chat e como a análise é feita */}
          <div style={s("display:grid;gap:clamp(14px,2vw,20px);align-content:start")}>
            <div
              style={s(
                "border:1px solid rgba(24,24,27,.12);border-radius:14px;padding:clamp(16px,2.4vw,24px);background:#fff"
              )}
            >
              <p
                style={s(
                  "font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#71717A"
                )}
              >
                Chat sobre o seu financeiro
              </p>
              <div style={s("margin-top:16px;display:grid;gap:12px")}>
                <p
                  style={s(
                    "font-size:14.5px;line-height:1.5;background:#F4F4F5;border-radius:10px 10px 10px 3px;padding:12px 14px;color:#27272A;justify-self:start;max-width:90%"
                  )}
                >
                  Por que o saldo disponível está menor que o resultado do mês?
                </p>
                <p
                  style={s(
                    "font-size:14.5px;line-height:1.6;border:1px solid rgba(109,40,217,.2);background:rgba(109,40,217,.04);border-radius:10px 10px 3px 10px;padding:12px 14px;color:#27272A;max-width:96%;text-wrap:pretty"
                  )}
                >
                  Porque R$ 32.800,13 estão guardados em caixinhas. O valor
                  aparece no patrimônio total de R$ 34.804,18, mas fica fora do
                  disponível até você retirar da reserva.
                </p>
              </div>
              <p
                style={s(
                  "margin-top:14px;padding-top:13px;border-top:1px solid rgba(24,24,27,.1);font-size:12.5px;line-height:1.55;color:#71717A;text-wrap:pretty"
                )}
              >
                O chat responde só sobre as suas finanças, e a conversa fica
                salva no seu navegador.
              </p>
            </div>
            <div
              style={s(
                "border:1px solid rgba(24,24,27,.12);border-radius:14px;padding:clamp(16px,2.4vw,24px)"
              )}
            >
              <h3 style={s("font-size:16px;font-weight:600;letter-spacing:-.01em")}>
                Como a análise é feita
              </h3>
              <ol style={s("margin-top:14px;display:grid;gap:11px;counter-reset:none")}>
                {ETAPAS.map((texto, i) => (
                  <li key={texto} style={s(ETAPA)}>
                    <span style={s(ETAPA_NUM)}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={s(ETAPA_TEXTO)}>{texto}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

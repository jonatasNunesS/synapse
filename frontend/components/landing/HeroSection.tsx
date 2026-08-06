"use client";
/** Landing — 1/10: hero com a headline e a tela do Financeiro. */
import Link from "next/link";
import { s } from "./css";
import estilos from "./landing.module.css";

/** Cartão pequeno da faixa inferior da tela do Financeiro. */
function Cartao({
  caixa,
  titulo,
  valor,
  rodape,
}: {
  caixa: string;
  titulo: string;
  valor: string;
  rodape: string;
}) {
  return (
    <div style={s(caixa)}>
      <p style={s("font-size:11.5px;color:#A1A1AA;margin-bottom:6px")}>{titulo}</p>
      <p
        style={s(
          "font-family:'IBM Plex Mono',monospace;font-size:16px;color:#F4F4F5"
        )}
      >
        {valor}
      </p>
      <p style={s("font-size:10.5px;color:#71717A;margin-top:4px")}>{rodape}</p>
    </div>
  );
}

export function HeroSection() {
  return (
    <section
      style={s(
        "max-width:1180px;margin:0 auto;padding:clamp(48px,9vw,104px) clamp(18px,4vw,36px) clamp(56px,9vw,110px)"
      )}
    >
      <p
        data-reveal
        style={s(
          "font-family:'IBM Plex Mono',monospace;font-size:11.5px;letter-spacing:.11em;text-transform:uppercase;color:#71717A;margin-bottom:clamp(20px,3vw,28px)"
        )}
      >
        Sistema de gestão para pequenos negócios
      </p>
      <h1
        data-reveal
        style={s(
          "font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(35px,7.4vw,56px);line-height:1.06;letter-spacing:-.015em;max-width:19ch;text-wrap:pretty"
        )}
      >
        Um sistema onde a venda, o estoque e o caixa andam juntos
      </h1>
      <p
        data-reveal
        style={s(
          "margin-top:clamp(20px,3vw,26px);font-size:clamp(16px,2.2vw,18px);line-height:1.6;color:#3F3F46;max-width:62ch;text-wrap:pretty"
        )}
      >
        Você lança uma venda e o Synapse cuida do resto: dá baixa no produto,
        registra o dinheiro e lembra você de cobrar. Serve para loja, marca de
        roupa, assessoria de eventos, consultoria, estética e prestador de
        serviço em geral.
      </p>
      <div
        data-reveal
        style={s(
          "margin-top:clamp(28px,4vw,36px);display:flex;flex-wrap:wrap;gap:12px;align-items:center"
        )}
      >
        <Link
          href="/registro"
          className={estilos.ctaPrimario}
          style={s(
            "font-size:15px;font-weight:500;color:#FAFAF9;background:#6D28D9;padding:13px 22px;border-radius:8px;box-shadow:0 1px 2px rgba(109,40,217,.28)"
          )}
        >
          Criar conta grátis
        </Link>
        <a
          href="#planos"
          className={estilos.ctaSecundario}
          style={s(
            "font-size:15px;font-weight:500;color:#18181B;padding:13px 20px;border-radius:8px;border:1px solid rgba(24,24,27,.16)"
          )}
        >
          Ver planos
        </a>
      </div>

      <figure data-reveal style={s("margin:clamp(40px,6vw,64px) 0 0")}>
        <div
          style={s(
            "background:#09090D;border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:clamp(14px,2.6vw,22px);box-shadow:0 24px 50px -28px rgba(9,9,13,.5),0 2px 6px rgba(9,9,13,.12);overflow:hidden"
          )}
        >
          <div
            style={s(
              "display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:clamp(14px,2vw,18px)"
            )}
          >
            <span
              style={s(
                "font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#A1A1AA"
              )}
            >
              Financeiro
            </span>
            <span
              style={s(
                "font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.06em;color:#71717A;border:1px solid rgba(255,255,255,.1);border-radius:5px;padding:3px 8px"
              )}
            >
              julho 2026
            </span>
          </div>
          <div
            style={s(
              "display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:clamp(10px,1.6vw,14px)"
            )}
          >
            <div
              style={s(
                "background:linear-gradient(180deg,rgba(74,222,128,.055),rgba(74,222,128,.015));border:1px solid rgba(74,222,128,.16);border-radius:11px;padding:clamp(14px,2vw,18px)"
              )}
            >
              <p style={s("font-size:12.5px;color:#A1A1AA;margin-bottom:8px")}>
                Saldo disponível
              </p>
              <p
                style={s(
                  "font-family:'IBM Plex Mono',monospace;font-size:clamp(24px,4.4vw,33px);font-weight:500;color:#4ADE80;letter-spacing:-.02em;line-height:1"
                )}
              >
                R$ 2.004,05
              </p>
              <p style={s("font-size:11.5px;color:#C4B5FD;margin-top:10px")}>
                Em caixinhas: R$ 32.800,13
              </p>
              <p style={s("font-size:11.5px;color:#71717A;margin-top:3px")}>
                Patrimônio total: R$ 34.804,18
              </p>
            </div>
            <div
              style={s(
                "background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:clamp(14px,2vw,18px)"
              )}
            >
              <p style={s("font-size:12.5px;color:#A1A1AA;margin-bottom:8px")}>
                Saldo do mês (julho)
              </p>
              <p
                style={s(
                  "font-family:'IBM Plex Mono',monospace;font-size:clamp(24px,4.4vw,33px);font-weight:500;color:#4ADE80;letter-spacing:-.02em;line-height:1"
                )}
              >
                +R$ 2.800,92
              </p>
              <p style={s("font-size:11.5px;color:#71717A;margin-top:10px")}>
                Recebido menos pago no período
              </p>
            </div>
          </div>
          <div
            style={s(
              "display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:clamp(10px,1.6vw,14px);margin-top:clamp(10px,1.6vw,14px)"
            )}
          >
            <Cartao
              caixa="background:rgba(74,222,128,.04);border:1px solid rgba(74,222,128,.12);border-radius:10px;padding:13px 14px"
              titulo="Recebido"
              valor="R$ 5.087,25"
              rodape="5 lançamentos"
            />
            <Cartao
              caixa="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:13px 14px"
              titulo="A receber"
              valor="R$ 0,00"
              rodape="0 lançamentos"
            />
            <Cartao
              caixa="background:rgba(239,68,68,.05);border:1px solid rgba(239,68,68,.14);border-radius:10px;padding:13px 14px"
              titulo="Pago"
              valor="R$ 2.286,33"
              rodape="19 lançamentos"
            />
            <Cartao
              caixa="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:13px 14px"
              titulo="A pagar"
              valor="R$ 0,00"
              rodape="0 lançamentos"
            />
          </div>
        </div>
        <figcaption
          style={s(
            "margin-top:14px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#71717A;line-height:1.5;max-width:60ch"
          )}
        >
          Tela do módulo Financeiro
        </figcaption>
      </figure>
    </section>
  );
}

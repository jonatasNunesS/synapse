"use client";
/** Landing — 10/10: chamada final. */
import Link from "next/link";
import { s } from "./css";
import estilos from "./landing.module.css";
import { WHATSAPP_URL } from "./contato";

export function FechamentoSection() {
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
            "font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(30px,5.4vw,50px);line-height:1.08;letter-spacing:-.015em;max-width:22ch;text-wrap:pretty"
          )}
        >
          Comece pelo próximo lançamento e veja o sistema seguir sozinho
        </h2>
        <p
          data-reveal
          style={s(
            "margin-top:18px;font-size:clamp(16px,2.2vw,18px);line-height:1.6;color:#3F3F46;max-width:52ch;text-wrap:pretty"
          )}
        >
          A conta é gratuita e o cadastro leva três etapas. Não há implantação,
          treinamento obrigatório nem cartão de crédito para testar.
        </p>
        <div
          data-reveal
          style={s(
            "margin-top:clamp(26px,4vw,34px);display:flex;flex-wrap:wrap;gap:12px;align-items:center"
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
            href={WHATSAPP_URL}
            className={estilos.ctaSecundario}
            style={s(
              "font-size:15px;font-weight:500;color:#18181B;padding:13px 20px;border-radius:8px;border:1px solid rgba(24,24,27,.16)"
            )}
          >
            Falar no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

"use client";
/** Landing — rodapé (contato, produto e links legais). */
import { s } from "./css";
import { MarcaSynapse } from "./MarcaSynapse";
import { WHATSAPP_LABEL, WHATSAPP_URL } from "./contato";

const COLUNA_TITULO =
  "font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:#A1A1AA";
const LISTA = "margin-top:12px;display:grid;gap:8px";
const LINK = "font-size:13.5px;color:#52525B";

export function LandingFooter() {
  return (
    <footer style={s("border-top:1px solid rgba(24,24,27,.09)")}>
      <div
        style={s(
          "max-width:1180px;margin:0 auto;padding:clamp(36px,6vw,56px) clamp(18px,4vw,36px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:clamp(20px,3vw,40px);align-items:start"
        )}
      >
        <div>
          <div style={s("display:flex;align-items:center;gap:9px")}>
            <MarcaSynapse />
            <span style={s("font-size:15px;font-weight:600;letter-spacing:-.01em")}>
              Synapse
            </span>
          </div>
          <p
            style={s(
              "margin-top:12px;font-size:13px;line-height:1.6;color:#71717A;max-width:32ch"
            )}
          >
            Sistema de gestão para pequenos negócios brasileiros.
          </p>
        </div>
        <div>
          <p style={s(COLUNA_TITULO)}>Contato</p>
          <ul style={s(LISTA)}>
            <li>
              <a href={WHATSAPP_URL} style={s("font-size:13.5px")}>
                {WHATSAPP_LABEL}
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p style={s(COLUNA_TITULO)}>Produto</p>
          <ul style={s(LISTA)}>
            <li>
              <a href="#modulos" style={s(LINK)}>
                Módulos
              </a>
            </li>
            <li>
              <a href="#planos" style={s(LINK)}>
                Planos
              </a>
            </li>
            <li>
              <a href="#faq" style={s(LINK)}>
                Perguntas frequentes
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p style={s(COLUNA_TITULO)}>Legal</p>
          <ul style={s(LISTA)}>
            <li>
              <a href="#" style={s(LINK)}>
                Termos de uso
              </a>
            </li>
            <li>
              <a href="#" style={s(LINK)}>
                Privacidade
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div
        style={s(
          "max-width:1180px;margin:0 auto;padding:0 clamp(18px,4vw,36px) clamp(28px,4vw,40px)"
        )}
      >
        <p
          style={s(
            "font-family:'IBM Plex Mono',monospace;font-size:11px;color:#A1A1AA"
          )}
        >
          © 2026 Synapse
        </p>
      </div>
    </footer>
  );
}

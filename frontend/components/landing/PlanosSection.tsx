"use client";
/**
 * Landing — 8/10: os três planos.
 *
 * Créditos e módulos são fixos; preço, limites e descrição do suporte vêm do
 * backend (GET /api/planos/). Enquanto o staff não define um preço, o cartão
 * mostra "preço a definir" — exatamente como o original.
 */
import Link from "next/link";
import { s } from "./css";
import estilos from "./landing.module.css";
import { formatarPreco, usePlanos, type NomePlano } from "@/hooks/usePlanos";

const CARTAO =
  "background:#FAFAF9;border:1px solid rgba(24,24,27,.12);border-radius:14px;padding:clamp(20px,2.6vw,26px);display:flex;flex-direction:column;gap:16px";
const CARTAO_DESTAQUE =
  "background:#FAFAF9;border:1px solid #18181B;border-radius:14px;padding:clamp(20px,2.6vw,26px);display:flex;flex-direction:column;gap:16px;box-shadow:0 12px 28px -20px rgba(24,24,27,.35)";
const TITULO = "font-size:16px;font-weight:600;letter-spacing:-.01em";
const SUBTITULO =
  "margin-top:7px;font-size:13.5px;line-height:1.55;color:#71717A;text-wrap:pretty";
const CREDITOS = "font-family:'IBM Plex Mono',monospace;font-size:22px;color:#18181B";
const CREDITOS_UNIDADE =
  "font-family:'IBM Plex Sans',sans-serif;font-size:13.5px;color:#71717A";
const LISTA = "display:grid;gap:9px;padding-top:15px;border-top:1px solid rgba(24,24,27,.1)";
const ITEM = "font-size:13.5px;color:#3F3F46;display:flex;gap:9px";
const PRECO = "font-family:'IBM Plex Mono',monospace;font-size:11px;color:#A1A1AA";
const BOTAO =
  "margin-top:auto;text-align:center;font-size:14px;font-weight:500;color:#18181B;border:1px solid rgba(24,24,27,.18);border-radius:8px;padding:11px 16px";
const BOTAO_DESTAQUE =
  "margin-top:auto;text-align:center;font-size:14px;font-weight:500;color:#FAFAF9;background:#6D28D9;border-radius:8px;padding:11px 16px";

interface CartaoPlano {
  plano: NomePlano;
  nome: string;
  subtitulo: string;
  creditos: string;
  itens: string[];
  destaque?: boolean;
}

const CARTOES: CartaoPlano[] = [
  {
    plano: "starter",
    nome: "Starter",
    subtitulo: "Para começar a organizar",
    creditos: "4",
    itens: [
      "Todos os 11 módulos",
      "2 análises financeiras por dia",
      "2 perguntas no chat por dia",
      "4 gerações de conteúdo por dia",
    ],
  },
  {
    plano: "pro",
    nome: "Pro",
    subtitulo: "Para acompanhar os números toda semana",
    creditos: "15",
    destaque: true,
    itens: [
      "Todos os 11 módulos",
      "7 análises financeiras por dia",
      "7 perguntas no chat por dia",
      "15 gerações de conteúdo por dia",
    ],
  },
  {
    plano: "business",
    nome: "Business",
    subtitulo: "Para uso diário e equipe maior",
    creditos: "40",
    itens: [
      "Todos os 11 módulos",
      "20 análises financeiras por dia",
      "20 perguntas no chat por dia",
      "40 gerações de conteúdo por dia",
    ],
  },
];

export function PlanosSection() {
  const planos = usePlanos();

  return (
    <section
      id="planos"
      style={s("border-top:1px solid rgba(24,24,27,.09);background:#F5F5F3")}
    >
      <div
        style={s(
          "max-width:1180px;margin:0 auto;padding:clamp(64px,11vw,140px) clamp(18px,4vw,36px)"
        )}
      >
        <h2
          data-reveal
          style={s(
            "font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(28px,5vw,44px);line-height:1.1;letter-spacing:-.01em;max-width:22ch;text-wrap:pretty"
          )}
        >
          Os três planos vêm com o sistema completo
        </h2>
        <p
          data-reveal
          style={s(
            "margin-top:16px;font-size:clamp(16px,2.2vw,17.5px);line-height:1.6;color:#52525B;max-width:58ch;text-wrap:pretty"
          )}
        >
          Nenhum módulo fica trancado no plano mais barato. A diferença está na
          quantidade de análises e perguntas para a IA que você pode fazer por
          dia.
        </p>

        <div
          style={s(
            "margin-top:clamp(32px,5vw,52px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:clamp(14px,2vw,20px);align-items:stretch"
          )}
        >
          {CARTOES.map((cartao) => {
            const config = planos.find((p) => p.plano === cartao.plano);
            const mensal = formatarPreco(config?.preco_mensal ?? null);
            const anual = formatarPreco(config?.preco_anual ?? null);
            // Limites e suporte só aparecem depois que o staff define.
            const extras: string[] = [];
            if (config?.limite_usuarios) {
              extras.push(
                `Até ${config.limite_usuarios} ${
                  config.limite_usuarios === 1 ? "usuário" : "usuários"
                }`
              );
            }
            if (config?.limite_armazenamento_gb) {
              extras.push(`${config.limite_armazenamento_gb} GB de armazenamento`);
            }
            if (config?.descricao_suporte) extras.push(config.descricao_suporte);

            return (
              <article
                key={cartao.plano}
                data-reveal
                style={s(cartao.destaque ? CARTAO_DESTAQUE : CARTAO)}
              >
                <div>
                  {cartao.destaque ? (
                    <div
                      style={s(
                        "display:flex;align-items:baseline;gap:9px;flex-wrap:wrap"
                      )}
                    >
                      <h3 style={s(TITULO)}>{cartao.nome}</h3>
                      <span
                        style={s(
                          "font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#6D28D9"
                        )}
                      >
                        indicado
                      </span>
                    </div>
                  ) : (
                    <h3 style={s(TITULO)}>{cartao.nome}</h3>
                  )}
                  <p style={s(SUBTITULO)}>{cartao.subtitulo}</p>
                </div>
                <p style={s(CREDITOS)}>
                  {cartao.creditos}{" "}
                  <span style={s(CREDITOS_UNIDADE)}>créditos de IA por dia</span>
                </p>
                <ul style={s(LISTA)}>
                  {[...cartao.itens, ...extras].map((item) => (
                    <li key={item} style={s(ITEM)}>
                      <span style={s("color:#6D28D9")}>·</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p style={s(PRECO)}>
                  {mensal
                    ? `${mensal} por mês${anual ? ` · ${anual} por ano` : ""}`
                    : "preço a definir"}
                </p>
                <Link
                  href="/registro"
                  className={cartao.destaque ? estilos.ctaPrimario : estilos.ctaPlano}
                  style={s(cartao.destaque ? BOTAO_DESTAQUE : BOTAO)}
                >
                  Começar
                </Link>
              </article>
            );
          })}
        </div>

        <div
          data-reveal
          style={s(
            "margin-top:clamp(24px,3.5vw,36px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:clamp(16px,3vw,40px);padding-top:clamp(24px,3.5vw,32px);border-top:1px solid rgba(24,24,27,.12)"
          )}
        >
          <div>
            <h3 style={s("font-size:15px;font-weight:600;letter-spacing:-.01em")}>
              Como funcionam os créditos
            </h3>
            <p
              style={s(
                "margin-top:9px;font-size:14px;line-height:1.6;color:#52525B;max-width:46ch;text-wrap:pretty"
              )}
            >
              Cada pedido à IA gasta crédito: análise e pergunta no chat custam
              2, escrever um texto custa 1. A conta zera todo dia à meia-noite e
              não acumula. Se algo der errado, o crédito volta.
            </p>
          </div>
          <div>
            <h3 style={s("font-size:15px;font-weight:600;letter-spacing:-.01em")}>
              Suporte
            </h3>
            <p
              style={s(
                "margin-top:9px;font-size:14px;line-height:1.6;color:#52525B;max-width:46ch;text-wrap:pretty"
              )}
            >
              Incluído nos três planos, pelo WhatsApp. Os limites de usuários e
              de armazenamento entram aqui quando estiverem definidos.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";
/**
 * Landing — 6/10: as seis perguntas do cadastro, ao vivo.
 *
 * Responder muda a barra lateral simulada na hora. Os dois presets
 * ("assessoria de eventos" e "loja de roupa") respondem tudo de uma vez;
 * mexer em qualquer resposta depois tira o preset do ar (vira "custom").
 */
import { useState } from "react";
import { s } from "./css";
import estilos from "./landing.module.css";
import { MarcaSynapse } from "./MarcaSynapse";

type ModuloOpcional =
  | "estoque"
  | "fornecedores"
  | "projetos"
  | "agenda"
  | "equipe"
  | "documentos";

type Respostas = Record<ModuloOpcional, boolean>;

const PERGUNTAS: { modulo: ModuloOpcional; pergunta: string }[] = [
  { modulo: "estoque", pergunta: "Controla estoque de produtos físicos?" },
  { modulo: "fornecedores", pergunta: "Compra de fornecedores regularmente?" },
  { modulo: "projetos", pergunta: "Trabalha com projetos ou eventos com prazo?" },
  { modulo: "agenda", pergunta: "Precisa de agenda para compromissos?" },
  { modulo: "equipe", pergunta: "Tem equipe ou trabalha sozinho?" },
  { modulo: "documentos", pergunta: "Precisa guardar contratos e documentos?" },
];

export const PRESET_LOJA: Respostas = {
  estoque: true,
  fornecedores: true,
  projetos: false,
  agenda: false,
  equipe: false,
  documentos: true,
};

export const PRESET_EVENTOS: Respostas = {
  estoque: false,
  fornecedores: false,
  projetos: true,
  agenda: true,
  equipe: true,
  documentos: true,
};

/** Dashboard, Financeiro, Clientes, Notificações, Analytics e AI Hub. */
const ITENS_FIXOS = 6;

const ITEM_MENU =
  "display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:7px;font-size:13.5px;color:#A1A1AA";
const ITEM_MENU_ATIVO =
  "display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:7px;font-size:13.5px;color:#FAFAFA;background:#6D28D9";
const PONTO_MENU = "width:5px;height:5px;border-radius:50%;background:#3F3F46";
const PONTO_MENU_ATIVO = "width:5px;height:5px;border-radius:50%;background:#DDD6FE";

/** Trilho do interruptor (o mesmo `sw(on)` do original). */
const trilho = (ligado: boolean) =>
  "width:38px;height:22px;flex:none;border-radius:999px;padding:2px;display:flex;justify-content:" +
  (ligado ? "flex-end" : "flex-start") +
  ";background:" +
  (ligado ? "#6D28D9" : "rgba(255,255,255,.14)") +
  ";transition:background .25s ease";

/** Bolinha do interruptor (`kn(on)`). */
const bolinha = (ligado: boolean) =>
  "width:18px;height:18px;border-radius:50%;background:" +
  (ligado ? "#FFFFFF" : "#A1A1AA") +
  ";display:block";

/** Botão de preset (`presetBtn(on)`). */
const botaoPreset = (ligado: boolean) =>
  "font-size:13px;font-weight:500;border-radius:999px;padding:8px 15px;transition:all .2s ease;border:1px solid " +
  (ligado ? "#6D28D9" : "rgba(255,255,255,.16)") +
  ";background:" +
  (ligado ? "rgba(109,40,217,.22)" : "transparent") +
  ";color:" +
  (ligado ? "#DDD6FE" : "#A1A1AA");

/** Menu simulado: os fixos mais os opcionais ligados, na ordem do sistema. */
function itensDoMenu(respostas: Respostas): { nome: string; ativo?: boolean }[] {
  const itens: { nome: string; ativo?: boolean }[] = [
    { nome: "Dashboard" },
    { nome: "Financeiro", ativo: true },
  ];
  if (respostas.estoque) itens.push({ nome: "Estoque" });
  itens.push({ nome: "Clientes" });
  if (respostas.fornecedores) itens.push({ nome: "Fornecedores" });
  if (respostas.projetos) itens.push({ nome: "Projetos" });
  if (respostas.agenda) itens.push({ nome: "Agenda" });
  if (respostas.equipe) itens.push({ nome: "Equipe" });
  if (respostas.documentos) itens.push({ nome: "Documentos" });
  itens.push({ nome: "Notificações" }, { nome: "Analytics" }, { nome: "AI Hub" });
  return itens;
}

export function PersonalizacaoSection() {
  const [respostas, setRespostas] = useState<Respostas>(PRESET_LOJA);
  const [preset, setPreset] = useState<"loja" | "eventos" | "custom">("loja");

  const alternar = (modulo: ModuloOpcional) => {
    setRespostas((r) => ({ ...r, [modulo]: !r[modulo] }));
    setPreset("custom");
  };

  const aplicarLoja = () => {
    setRespostas(PRESET_LOJA);
    setPreset("loja");
  };

  const aplicarEventos = () => {
    setRespostas(PRESET_EVENTOS);
    setPreset("eventos");
  };

  const itens = itensDoMenu(respostas);
  // 6 itens fixos + os opcionais ligados, de um total de 12.
  const contagem = ITENS_FIXOS + PERGUNTAS.filter((p) => respostas[p.modulo]).length;

  return (
    <section
      id="personalizacao"
      style={s(
        "border-top:1px solid rgba(24,24,27,.09);background:#0A0A0F;color:#FAFAFA"
      )}
    >
      <div
        style={s(
          "max-width:1180px;margin:0 auto;padding:clamp(64px,11vw,140px) clamp(18px,4vw,36px)"
        )}
      >
        <p
          data-reveal
          style={s(
            "font-family:'IBM Plex Mono',monospace;font-size:11.5px;letter-spacing:.11em;text-transform:uppercase;color:#A1A1AA"
          )}
        >
          Personalização
        </p>
        <h2
          data-reveal
          style={s(
            "margin-top:18px;font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(28px,5vw,46px);line-height:1.1;letter-spacing:-.01em;max-width:24ch;color:#FAFAFA;text-wrap:pretty"
          )}
        >
          O cadastro faz seis perguntas e monta o sistema a partir delas
        </h2>
        <p
          data-reveal
          style={s(
            "margin-top:18px;font-size:clamp(16px,2.2vw,17.5px);line-height:1.6;color:#A1A1AA;max-width:56ch;text-wrap:pretty"
          )}
        >
          Responda abaixo para ver o menu mudar. É a mesma tela da última etapa
          do cadastro.
        </p>

        <div
          style={s(
            "margin-top:clamp(32px,5vw,52px);display:flex;flex-wrap:wrap;gap:10px;align-items:center"
          )}
        >
          <span
            style={s(
              "font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#71717A;margin-right:4px"
            )}
          >
            Começar como
          </span>
          <button
            type="button"
            onClick={aplicarEventos}
            aria-pressed={preset === "eventos"}
            style={s(botaoPreset(preset === "eventos"))}
          >
            Assessoria de eventos
          </button>
          <button
            type="button"
            onClick={aplicarLoja}
            aria-pressed={preset === "loja"}
            style={s(botaoPreset(preset === "loja"))}
          >
            Loja de roupa
          </button>
        </div>

        <div
          style={s(
            "margin-top:clamp(20px,3vw,28px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:clamp(16px,2.6vw,32px);align-items:start"
          )}
        >
          <ul
            style={s(
              "display:grid;gap:1px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden"
            )}
          >
            {PERGUNTAS.map(({ modulo, pergunta }) => {
              const ligado = respostas[modulo];
              return (
                <li key={modulo} style={s("background:#0E0E14")}>
                  <button
                    type="button"
                    onClick={() => alternar(modulo)}
                    aria-pressed={ligado}
                    className={estilos.linhaToggle}
                    style={s(
                      "width:100%;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px 16px;text-align:left"
                    )}
                  >
                    <span style={s("font-size:14.5px;line-height:1.4;color:#E4E4E7")}>
                      {pergunta}
                    </span>
                    <span style={s(trilho(ligado))}>
                      <span style={s(bolinha(ligado))} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div>
            <div
              style={s(
                "border:1px solid rgba(255,255,255,.09);border-radius:12px;overflow:hidden;background:#0E0E14"
              )}
            >
              <div
                style={s(
                  "display:flex;align-items:center;gap:9px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.07)"
                )}
              >
                <MarcaSynapse tamanho={22} />
                <span style={s("font-size:14px;font-weight:500;color:#FAFAFA")}>
                  Synapse
                </span>
              </div>
              <ul aria-live="polite" style={s("padding:8px;display:grid;gap:1px")}>
                {itens.map((item) => (
                  <li key={item.nome} style={s(item.ativo ? ITEM_MENU_ATIVO : ITEM_MENU)}>
                    <span style={s(item.ativo ? PONTO_MENU_ATIVO : PONTO_MENU)} />
                    {item.nome}
                  </li>
                ))}
              </ul>
            </div>
            <p
              style={s(
                "margin-top:14px;font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.6;color:#71717A"
              )}
            >
              {contagem} de 12 itens na barra lateral
            </p>
            <p
              style={s(
                "margin-top:10px;font-size:13.5px;line-height:1.6;color:#A1A1AA;max-width:44ch;text-wrap:pretty"
              )}
            >
              As respostas também simplificam o dia a dia: quem não controla
              estoque não recebe a pergunta sobre dar baixa ao vender.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

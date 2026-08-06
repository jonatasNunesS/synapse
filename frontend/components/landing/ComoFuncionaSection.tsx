"use client";
/**
 * Landing — 3/10: o caminho de uma venda dentro do sistema.
 *
 * A trilha à esquerda acompanha a rolagem: o passo em foco acende o ponto, a
 * linha roxa cresce e o cartão escuro ganha borda. No original isso era feito
 * mexendo no style dos nós; aqui o índice ativo vira estado e os estilos são
 * derivados no render.
 */
import { s } from "./css";
import { useFlowSteps } from "@/hooks/useLandingMotion";

const PASSO =
  "position:relative;padding:0 0 clamp(40px,6vw,64px) 44px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:clamp(20px,3vw,40px);align-items:start";
const PASSO_ULTIMO =
  "position:relative;padding:0 0 8px 44px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:clamp(20px,3vw,40px);align-items:start";
const PONTO =
  "position:absolute;left:0;top:4px;width:23px;height:23px;border-radius:50%;background:#FAFAF9;border:1px solid rgba(24,24,27,.18);display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:#71717A;transition:all .4s ease";
const ARTEFATO =
  "background:#09090D;border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:clamp(14px,2vw,18px);transition:border-color .4s ease,box-shadow .4s ease";
const ROTULO =
  "font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#A1A1AA";
const LINHA_DL = "display:flex;justify-content:space-between;gap:10px";
const DT = "font-size:12.5px;color:#A1A1AA";
const DD = "margin:0;font-size:12.5px;color:#F4F4F5";

const PASSOS = [
  {
    titulo: "Você lança a venda na ficha do cliente",
    texto:
      "Dois moletons para a Ana Beatriz, R$ 240,00, para receber no dia 10. É o único lugar onde você digita algo.",
  },
  {
    titulo: "O sistema oferece dar baixa no estoque",
    texto:
      "Você vê quanto tinha e quanto vai ficar antes de decidir. Se a quantidade não fecha com o estoque, ele avisa na hora.",
  },
  {
    titulo: "Depois, oferece lançar o valor no financeiro",
    texto:
      "A venda foi a prazo, então o valor entra como previsto. Ele aparece em “a receber”, e não no dinheiro que você tem hoje.",
  },
  {
    titulo: "No dia combinado, o aviso chega para você",
    texto:
      "Se o cliente pagou menos, você registra o valor real e o que faltou vira uma nova cobrança. Se não pagou, é um clique para adiar.",
  },
];

function ArtefatoInteracao() {
  return (
    <>
      <div
        style={s(
          "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px"
        )}
      >
        <span style={s(ROTULO)}>Clientes · nova interação</span>
      </div>
      <div
        style={s(
          "display:flex;align-items:center;gap:11px;padding-bottom:13px;border-bottom:1px solid rgba(255,255,255,.07)"
        )}
      >
        <span
          style={s(
            "width:30px;height:30px;border-radius:50%;background:#3B0764;color:#DDD6FE;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:500"
          )}
        >
          AB
        </span>
        <div>
          <p style={s("font-size:13.5px;color:#F4F4F5")}>Ana Beatriz Rocha</p>
          <p style={s("font-size:11px;color:#71717A;margin-top:2px")}>
            Cliente desde março · ticket médio R$ 264,00
          </p>
        </div>
      </div>
      <dl style={s("margin:13px 0 0;display:grid;gap:9px")}>
        <div style={s(LINHA_DL)}>
          <dt style={s(DT)}>Tipo</dt>
          <dd style={s(DD)}>Venda</dd>
        </div>
        <div style={s(LINHA_DL)}>
          <dt style={s(DT)}>Item</dt>
          <dd style={s(DD)}>2 × Moletom 3 cabos</dd>
        </div>
        <div style={s(LINHA_DL)}>
          <dt style={s(DT)}>Valor</dt>
          <dd
            style={s(
              "margin:0;font-family:'IBM Plex Mono',monospace;font-size:13px;color:#F4F4F5"
            )}
          >
            R$ 240,00
          </dd>
        </div>
        <div style={s(LINHA_DL)}>
          <dt style={s(DT)}>Pagamento</dt>
          <dd
            style={s(
              "margin:0;font-size:12px;color:#FCD34D;background:rgba(252,211,77,.1);border:1px solid rgba(252,211,77,.2);border-radius:5px;padding:2px 7px"
            )}
          >
            pendente · 10/08
          </dd>
        </div>
      </dl>
    </>
  );
}

function ArtefatoEstoque() {
  return (
    <>
      <p style={s(`${ROTULO};margin-bottom:12px`)}>Estoque · confirmação</p>
      <p style={s("font-size:14.5px;color:#F4F4F5;line-height:1.45")}>
        Baixar 2 unidades do estoque?
      </p>
      <div
        style={s(
          "margin-top:13px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:13px"
        )}
      >
        <p style={s("font-size:12.5px;color:#E4E4E7")}>
          Moletom 3 cabos · categoria Moletons
        </p>
        <div
          style={s(
            "margin-top:11px;display:flex;align-items:center;gap:12px;font-family:'IBM Plex Mono',monospace;font-size:15px"
          )}
        >
          <span style={s("color:#71717A")}>4</span>
          <span style={s("color:#52525B;font-size:12px")}>→</span>
          <span style={s("color:#FCD34D")}>2</span>
          <span
            style={s(
              "font-family:'IBM Plex Sans',sans-serif;font-size:11px;color:#FCD34D;margin-left:auto"
            )}
          >
            chega no mínimo (2)
          </span>
        </div>
      </div>
      <div style={s("margin-top:13px;display:flex;gap:9px")}>
        <span
          style={s(
            "font-size:12.5px;font-weight:500;color:#fff;background:#6D28D9;border-radius:7px;padding:8px 14px"
          )}
        >
          Sim, baixar
        </span>
        <span
          style={s(
            "font-size:12.5px;color:#A1A1AA;border:1px solid rgba(255,255,255,.12);border-radius:7px;padding:8px 14px"
          )}
        >
          Agora não
        </span>
      </div>
    </>
  );
}

function ArtefatoFinanceiro() {
  return (
    <>
      <p style={s(`${ROTULO};margin-bottom:12px`)}>Financeiro · lançamento</p>
      <div
        style={s(
          "display:flex;align-items:baseline;justify-content:space-between;gap:12px"
        )}
      >
        <p style={s("font-size:13.5px;color:#F4F4F5")}>Venda · Ana Beatriz Rocha</p>
        <p
          style={s(
            "font-family:'IBM Plex Mono',monospace;font-size:15px;color:#4ADE80"
          )}
        >
          +R$ 240,00
        </p>
      </div>
      <dl
        style={s(
          "margin:14px 0 0;display:grid;gap:9px;padding-top:13px;border-top:1px solid rgba(255,255,255,.07)"
        )}
      >
        <div style={s(LINHA_DL)}>
          <dt style={s(DT)}>Categoria</dt>
          <dd style={s(DD)}>Vendas</dd>
        </div>
        <div style={s(LINHA_DL)}>
          <dt style={s(DT)}>Vencimento</dt>
          <dd
            style={s(
              "margin:0;font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:#F4F4F5"
            )}
          >
            10/08/2026
          </dd>
        </div>
        <div style={s(LINHA_DL)}>
          <dt style={s(DT)}>Status</dt>
          <dd style={s("margin:0;font-size:12px;color:#FCD34D")}>a receber</dd>
        </div>
      </dl>
      <p
        style={s(
          "margin-top:13px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07);font-size:11.5px;line-height:1.5;color:#71717A"
        )}
      >
        Só entra no saldo quando você confirmar que o dinheiro caiu.
      </p>
    </>
  );
}

function ArtefatoNotificacao() {
  return (
    <>
      <p style={s(`${ROTULO};margin-bottom:12px`)}>Notificação · hoje, 08:00</p>
      <p style={s("font-size:14.5px;color:#F4F4F5;line-height:1.45")}>
        Ana Beatriz ficou de pagar hoje:{" "}
        <span
          style={s("font-family:'IBM Plex Mono',monospace;color:#4ADE80")}
        >
          R$ 240,00
        </span>
      </p>
      <p style={s("margin-top:7px;font-size:12px;color:#A1A1AA")}>
        Referente a: Venda — 2 Moletom 3 cabos
      </p>
      <div style={s("margin-top:14px;display:flex;flex-wrap:wrap;gap:9px")}>
        <span
          style={s(
            "font-size:12.5px;font-weight:500;color:#fff;background:#6D28D9;border-radius:7px;padding:8px 13px"
          )}
        >
          Confirmar recebimento
        </span>
        <span
          style={s(
            "font-size:12.5px;color:#A1A1AA;border:1px solid rgba(255,255,255,.12);border-radius:7px;padding:8px 13px"
          )}
        >
          Adiar prazo
        </span>
        <span
          style={s(
            "font-size:12.5px;color:#A1A1AA;border:1px solid rgba(255,255,255,.12);border-radius:7px;padding:8px 13px"
          )}
        >
          Cancelar
        </span>
      </div>
      <p
        style={s(
          "margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07);font-size:11.5px;line-height:1.5;color:#71717A"
        )}
      >
        Se ela pagar R$ 200,00, o sistema oferece cobrar os R$ 40,00 que
        faltaram.
      </p>
    </>
  );
}

const ARTEFATOS = [
  ArtefatoInteracao,
  ArtefatoEstoque,
  ArtefatoFinanceiro,
  ArtefatoNotificacao,
];

export function ComoFuncionaSection() {
  const { ativo, registrar } = useFlowSteps(PASSOS.length);

  return (
    <section id="como-funciona" style={s("border-top:1px solid rgba(24,24,27,.09)")}>
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
          Como funciona
        </p>
        <h2
          data-reveal
          style={s(
            "margin-top:18px;font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(28px,5vw,46px);line-height:1.1;letter-spacing:-.01em;max-width:26ch;text-wrap:pretty"
          )}
        >
          O caminho de uma venda dentro do sistema
        </h2>
        <p
          data-reveal
          style={s(
            "margin-top:18px;font-size:clamp(16px,2.2vw,17.5px);line-height:1.6;color:#52525B;max-width:58ch;text-wrap:pretty"
          )}
        >
          Cada etapa é uma pergunta rápida, com o resultado à vista antes de você
          confirmar. Nada acontece sem o seu ok.
        </p>

        <div style={s("position:relative;margin-top:clamp(40px,6vw,72px)")}>
          <div
            style={s(
              "position:absolute;left:11px;top:12px;bottom:12px;width:1px;background:rgba(24,24,27,.12)"
            )}
            aria-hidden="true"
          />
          <div
            style={{
              ...s(
                "position:absolute;left:11px;top:12px;width:1px;height:0;background:#6D28D9;transition:height .25s linear"
              ),
              height: `${Math.round(((ativo + 1) / PASSOS.length) * 100)}%`,
            }}
            aria-hidden="true"
          />

          {PASSOS.map((passo, k) => {
            const percorrido = k <= ativo;
            const emFoco = k === ativo;
            const Artefato = ARTEFATOS[k];
            return (
              <div
                key={passo.titulo}
                ref={registrar(k)}
                style={s(k === PASSOS.length - 1 ? PASSO_ULTIMO : PASSO)}
              >
                <span
                  style={{
                    ...s(PONTO),
                    background: emFoco ? "#6D28D9" : "#FAFAF9",
                    borderColor: percorrido ? "#6D28D9" : "rgba(24,24,27,.18)",
                    color: emFoco ? "#FFFFFF" : percorrido ? "#6D28D9" : "#71717A",
                  }}
                >
                  {k + 1}
                </span>
                <div
                  style={{
                    ...s("transition:opacity .4s ease"),
                    opacity: percorrido ? "1" : "0.5",
                  }}
                >
                  <h3
                    style={s(
                      "font-size:clamp(19px,2.6vw,23px);font-weight:600;letter-spacing:-.01em;line-height:1.25"
                    )}
                  >
                    {passo.titulo}
                  </h3>
                  <p
                    style={s(
                      "margin-top:10px;font-size:16px;line-height:1.6;color:#52525B;max-width:44ch;text-wrap:pretty"
                    )}
                  >
                    {passo.texto}
                  </p>
                </div>
                <div
                  style={{
                    ...s(ARTEFATO),
                    borderColor: emFoco
                      ? "rgba(167,139,250,.42)"
                      : "rgba(255,255,255,.09)",
                    boxShadow: emFoco
                      ? "0 18px 38px -26px rgba(9,9,13,.55)"
                      : "none",
                  }}
                >
                  <Artefato />
                </div>
              </div>
            );
          })}
        </div>

        <p
          data-reveal
          style={s(
            "margin-top:clamp(36px,5vw,56px);padding-top:clamp(28px,4vw,36px);border-top:1px solid rgba(24,24,27,.12);font-size:clamp(18px,2.6vw,22px);line-height:1.45;max-width:46ch;text-wrap:pretty"
          )}
        >
          No fim, três partes do sistema estão atualizadas e você digitou uma vez
          só.
        </p>
      </div>
    </section>
  );
}

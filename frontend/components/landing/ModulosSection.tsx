"use client";
/** Landing — 4/10: os onze módulos. */
import { s } from "./css";

const CARTAO = "background:#FAFAF9;padding:clamp(20px,2.6vw,28px)";
const CARTAO_LARGO =
  "grid-column:span 2;background:#FAFAF9;padding:clamp(20px,2.6vw,28px)";
const CARTAO_ESCURO =
  "grid-column:span 2;background:#0C0C12;padding:clamp(20px,2.6vw,28px)";
const TITULO = "font-size:17px;font-weight:600;letter-spacing:-.01em";
const TEXTO =
  "margin-top:9px;font-size:14.5px;line-height:1.6;color:#52525B;text-wrap:pretty";
const TEXTO_LARGO =
  "margin-top:9px;font-size:14.5px;line-height:1.6;color:#52525B;max-width:52ch;text-wrap:pretty";
const TAG =
  "font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#6D28D9";

interface Modulo {
  nome: string;
  texto: string;
  tag?: string;
  largo?: boolean;
  escuro?: boolean;
}

const MODULOS: Modulo[] = [
  {
    nome: "Financeiro",
    tag: "essencial",
    largo: true,
    texto:
      "Entradas e saídas, contas a receber e a pagar, reservas em caixinhas, empréstimos e relatório de resultado. Contas que repetem todo mês só entram no saldo depois que você confirma que aconteceram.",
  },
  {
    nome: "Clientes e CRM",
    tag: "essencial",
    largo: true,
    texto:
      "Um funil que você arrasta com o dedo, o histórico de cada conversa e proposta, quanto o cliente já gastou e há quanto tempo não compra. Vendas a prazo entram com data de cobrança.",
  },
  {
    nome: "Estoque",
    texto:
      "Produtos com tamanho e cor, aviso quando o estoque fica baixo, e histórico que não se apaga: erro se corrige com um lançamento de correção.",
  },
  {
    nome: "Fornecedores",
    texto:
      "Cada fornecedor recebe nota por qualidade, prazo e preço. Serve para saber de quem vale a pena comprar de novo.",
  },
  {
    nome: "Projetos",
    texto:
      "Um quadro de tarefas para cada trabalho em andamento, com prazo, responsável e o quanto já foi entregue.",
  },
  {
    nome: "Agenda",
    texto:
      "Cada compromisso pode ficar ligado a um cliente, então você vê de quem é a reunião e o histórico dele.",
  },
  {
    nome: "AI Hub",
    tag: "diferencial",
    largo: true,
    escuro: true,
    texto:
      "Uma leitura do seu mês com os valores em reais e a comparação com o mês anterior, um chat para perguntar sobre as suas contas, e ajuda para escrever legenda e descrição de produto.",
  },
  {
    nome: "Equipe",
    texto:
      "Convite por e-mail, três níveis de acesso, metas por pessoa e um quadro de tarefas que a sua empresa organiza do jeito que quiser.",
  },
  {
    nome: "Documentos",
    texto:
      "Contratos e arquivos guardados por tipo, com controle de versão e aviso quando a validade está perto.",
  },
  {
    nome: "Dashboard",
    texto:
      "A abertura do sistema: saldo, vendas, cobranças do dia e alertas — só dos módulos que você usa.",
  },
  {
    nome: "Notificações",
    texto:
      "Contas vencendo, estoque baixo, cobranças do dia e retorno de cliente, com a ação para resolver ali mesmo.",
  },
];

export function ModulosSection() {
  return (
    <section
      id="modulos"
      style={s("border-top:1px solid rgba(24,24,27,.09);background:#F5F5F3")}
    >
      <div
        style={s(
          "max-width:1180px;margin:0 auto;padding:clamp(64px,11vw,140px) clamp(18px,4vw,36px)"
        )}
      >
        <div
          data-reveal
          style={s(
            "display:flex;flex-wrap:wrap;gap:clamp(18px,4vw,48px);align-items:flex-end;justify-content:space-between"
          )}
        >
          <h2
            style={s(
              "font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(28px,5vw,44px);line-height:1.1;letter-spacing:-.01em;max-width:20ch;text-wrap:pretty"
            )}
          >
            Onze módulos, e você escolhe quais usar
          </h2>
          <p
            style={s(
              "font-size:14.5px;line-height:1.6;color:#52525B;max-width:38ch;text-wrap:pretty"
            )}
          >
            Desligar um módulo só o esconde da tela. Se você voltar a precisar
            dele meses depois, tudo que estava cadastrado continua no lugar.
          </p>
        </div>

        <div
          style={s(
            "margin-top:clamp(32px,5vw,56px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:1px;background:rgba(24,24,27,.12);border:1px solid rgba(24,24,27,.12);border-radius:12px;overflow:hidden"
          )}
        >
          {MODULOS.map((modulo) => (
            <article
              key={modulo.nome}
              data-reveal
              style={s(
                modulo.escuro
                  ? CARTAO_ESCURO
                  : modulo.largo
                    ? CARTAO_LARGO
                    : CARTAO
              )}
            >
              {modulo.tag ? (
                <div
                  style={s(
                    "display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"
                  )}
                >
                  <h3 style={s(modulo.escuro ? `${TITULO};color:#FAFAFA` : TITULO)}>
                    {modulo.nome}
                  </h3>
                  <span
                    style={s(modulo.escuro ? TAG.replace("#6D28D9", "#C4B5FD") : TAG)}
                  >
                    {modulo.tag}
                  </span>
                </div>
              ) : (
                <h3 style={s(TITULO)}>{modulo.nome}</h3>
              )}
              <p
                style={s(
                  modulo.escuro
                    ? TEXTO_LARGO.replace("#52525B", "#A1A1AA")
                    : modulo.largo
                      ? TEXTO_LARGO
                      : TEXTO
                )}
              >
                {modulo.texto}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

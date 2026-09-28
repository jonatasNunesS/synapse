"use client";
/**
 * Synapse — Os compromissos de um projeto ou de uma venda.
 *
 * Mesmo problema que o perfil do cliente tinha antes da Leva 2: a ligação era
 * de mão única. Do evento dava para chegar ao projeto; do projeto não dava
 * para ver os eventos.
 *
 * Visual espelhado no `CompromissosCliente` de propósito — é a mesma ideia em
 * outro lugar, e duas aparências diferentes para a mesma coisa só confundiriam.
 * Não foi unificado num componente só porque o do cliente carrega regras que
 * são dele: o selo de follow-up e o corte do prefixo "Follow-up:" no título,
 * que fora do perfil do cliente não querem dizer nada.
 *
 * Um evento que tem cliente E projeto aparece nos dois lugares. Isso é
 * correto, não duplicação: o evento É dos dois.
 */
import Link from "next/link";
import { CalendarDays, Clock } from "lucide-react";
import type { Evento } from "@/types/agenda";

/** Quantos compromissos passados mostrar — o resto é história, está na Agenda. */
const MAXIMO_PASSADOS = 3;

interface Props {
  eventos: Evento[];
  loading: boolean;
  /**
   * O instante que separa "já foi" de "vem aí", em ms — vem do hook, marcado
   * quando a lista chegou. Ler o relógio no render deixaria o resultado
   * instável entre renderizações, e o React avisa.
   */
  agora: number;
  /** Completa "Nenhum compromisso ..." — ex.: "neste projeto", "nesta venda". */
  vazioSufixo: string;
}

/** Separa o que vem do que já foi. Igual à do cliente, e testada aqui também. */
export function separarPorTempo(eventos: Evento[], agora: number) {
  const proximos = eventos.filter((e) => new Date(e.data_fim).getTime() >= agora);
  // Os passados vêm da API em ordem crescente; aqui o mais recente primeiro.
  const passados = eventos
    .filter((e) => new Date(e.data_fim).getTime() < agora)
    .reverse()
    .slice(0, MAXIMO_PASSADOS);
  return { proximos, passados };
}

function quando(evento: Evento): string {
  const d = new Date(evento.data_inicio);
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  if (evento.dia_inteiro) return `${data} · dia inteiro`;
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${data} · ${hora}`;
}

function Linha({ evento, passado }: { evento: Evento; passado?: boolean }) {
  return (
    <Link
      href="/agenda"
      className={`flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted ${
        passado ? "opacity-60" : ""
      }`}
    >
      <span
        aria-hidden
        className="h-6 w-1 flex-shrink-0 rounded-full"
        // `cor_efetiva`: a cor da categoria quando há uma, senão a antiga do
        // evento. Nunca `.cor` direto — há um teste-guarda contra isso.
        style={{ backgroundColor: evento.cor_efetiva }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{evento.titulo}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 flex-shrink-0" />
          {quando(evento)}
        </p>
      </div>
      {evento.categoria_nome && (
        <span className="flex-shrink-0 truncate rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {evento.categoria_nome}
        </span>
      )}
    </Link>
  );
}

export function CompromissosVinculados({
  eventos,
  loading,
  agora,
  vazioSufixo,
}: Props) {
  const { proximos, passados } = separarPorTempo(eventos, agora);

  return (
    <div
      data-testid="compromissos-vinculados"
      className="bg-card shadow-elevacao border border-border rounded-xl p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarDays className="h-4 w-4 text-brand-accent" />
          Compromissos
        </h3>
        <Link
          href="/agenda"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Ver agenda
        </Link>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : eventos.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum compromisso {vazioSufixo}.
        </p>
      ) : (
        <div className="space-y-1">
          {proximos.map((e) => (
            <Linha key={e.id} evento={e} />
          ))}

          {proximos.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              Nenhum compromisso à frente.
            </p>
          )}

          {passados.length > 0 && (
            <>
              <p className="px-2 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Já aconteceram
              </p>
              {passados.map((e) => (
                <Linha key={e.id} evento={e} passado />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

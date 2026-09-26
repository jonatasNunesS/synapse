"use client";
/**
 * Os compromissos deste cliente, no perfil dele.
 *
 * Até aqui a ligação era de mão única: do evento dava para chegar ao cliente,
 * do cliente não dava para ver os eventos. O perfil só oferecia CRIAR um
 * follow-up e nunca mostrava os que já existiam.
 *
 * Fica na coluna da esquerda, logo abaixo do cartão de follow-up, porque é
 * dele que a maior parte destes compromissos nasce.
 *
 * Seção própria, e não mais uma faixa na timeline: a timeline é o registro do
 * que ACONTECEU (interações, vendas) e o compromisso é o que VAI acontecer.
 * Misturar os dois tempos numa lista só deixa as duas mais difíceis de ler.
 */
import Link from "next/link";
import { CalendarDays, Clock } from "lucide-react";
import type { Evento } from "@/types/agenda";

interface Props {
  eventos: Evento[];
  loading: boolean;
  /**
   * O instante que separa "já foi" de "vem aí", em ms — vem do hook, marcado
   * quando a lista chegou. Ler o relógio aqui dentro deixaria o resultado
   * instável entre renderizações, e o React avisa.
   */
  agora: number;
}

/** Quantos compromissos passados mostrar — o resto é história, está na Agenda. */
const MAXIMO_PASSADOS = 3;

/**
 * O evento nasceu do follow-up deste cliente?
 *
 * O marcador é o prefixo do título, que é exatamente o que o backend usa para
 * não duplicar o evento (`titulo__startswith="Follow-up:"` em
 * `clientes/services.py`). Não há FK registrando essa origem — usar o mesmo
 * marcador que o backend usa é o mais honesto que dá para fazer daqui.
 */
export function veioDeFollowup(evento: Evento): boolean {
  return evento.titulo.startsWith("Follow-up:");
}

/**
 * Dentro do perfil da Maria, "Follow-up: Maria" repete o nome dela de volta.
 * Some com o prefixo e deixa o selo explicar de onde veio.
 */
export function tituloNoPerfil(evento: Evento): string {
  return veioDeFollowup(evento)
    ? evento.titulo.slice("Follow-up:".length).trim() || "Follow-up"
    : evento.titulo;
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
        style={{ backgroundColor: evento.cor_efetiva }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{tituloNoPerfil(evento)}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 flex-shrink-0" />
          {quando(evento)}
        </p>
      </div>
      {veioDeFollowup(evento) && (
        <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-alerta bg-yellow-500/10">
          follow-up
        </span>
      )}
    </Link>
  );
}

/** Separa o que vem do que já foi, a partir do instante recebido. */
export function separarPorTempo(eventos: Evento[], agora: number) {
  const proximos = eventos.filter((e) => new Date(e.data_fim).getTime() >= agora);
  // Os passados vêm da API em ordem crescente; aqui o mais recente primeiro.
  const passados = eventos
    .filter((e) => new Date(e.data_fim).getTime() < agora)
    .reverse()
    .slice(0, MAXIMO_PASSADOS);
  return { proximos, passados };
}

export function CompromissosCliente({ eventos, loading, agora }: Props) {
  const { proximos, passados } = separarPorTempo(eventos, agora);

  return (
    <div
      data-testid="compromissos-cliente"
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
          Nenhum compromisso com este cliente.
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

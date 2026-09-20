"use client";
/**
 * Configurações → Expediente da Agenda.
 *
 * A empresa diz a que horas trabalha, e as visões de dia e semana passam a
 * desenhar só essa faixa — sem isso, ~10h de madrugada vazia ocupam metade
 * da tela (AGENDA_AUDIT, item 8).
 *
 * O recorte é de DESENHO: nenhum evento é escondido. Quem marcou algo às 5h
 * continua vendo na lista, e a grade rola até lá.
 *
 * Só admin altera — é como a empresa trabalha, não preferência individual.
 * Os demais veem a configuração atual com os controles desabilitados.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Clock, Loader2 } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import {
  DURACAO_PADRAO_MIN,
  EXPEDIENTE_PADRAO,
  type Usuario,
} from "@/types/auth";

/** "07:00" — o rótulo de uma hora cheia. */
export function rotuloHora(hora: number): string {
  return `${String(hora).padStart(2, "0")}:00`;
}

/** As horas que a pessoa pode escolher para começar: 0h às 23h. */
const HORAS_INICIO = Array.from({ length: 24 }, (_, h) => h);
/** E para terminar: 1h às 24h ("24:00" é o fim do dia). */
const HORAS_FIM = Array.from({ length: 24 }, (_, i) => i + 1);

/** Durações oferecidas para um evento novo, em minutos. */
export const DURACOES = [15, 30, 45, 60, 90, 120, 180, 240];

/** "1h30" — como a duração aparece na lista. */
export function rotuloDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas}h${String(resto).padStart(2, "0")}` : `${horas}h`;
}

export function ExpedienteSection() {
  const usuario = useAppStore((s) => s.usuario);
  const setUsuario = useAppStore((s) => s.setUsuario);
  const isAdmin = usuario?.perfil === "admin";

  const atualInicio =
    usuario?.empresa?.agenda_hora_inicio ?? EXPEDIENTE_PADRAO.inicio;
  const atualFim = usuario?.empresa?.agenda_hora_fim ?? EXPEDIENTE_PADRAO.fim;

  const atualDuracao =
    usuario?.empresa?.agenda_duracao_padrao ?? DURACAO_PADRAO_MIN;

  const [inicio, setInicio] = useState(atualInicio);
  const [fim, setFim] = useState(atualFim);
  const [duracao, setDuracao] = useState(atualDuracao);
  const [salvando, setSalvando] = useState(false);

  const mudou =
    inicio !== atualInicio || fim !== atualFim || duracao !== atualDuracao;
  const invertido = fim <= inicio;

  const salvar = async () => {
    if (!isAdmin || salvando || invertido) return;
    setSalvando(true);
    try {
      const resp = await api.patch<{
        agenda_hora_inicio: number;
        agenda_hora_fim: number;
        agenda_duracao_padrao: number;
      }>("/auth/empresa/agenda/", {
        agenda_hora_inicio: inicio,
        agenda_hora_fim: fim,
        agenda_duracao_padrao: duracao,
      });
      const salvo = resp.data;
      if (salvo && usuario?.empresa) {
        // A agenda lê daqui; sem isto a grade só mudaria no próximo load.
        setUsuario({
          ...usuario,
          empresa: {
            ...usuario.empresa,
            agenda_hora_inicio: salvo.agenda_hora_inicio,
            agenda_hora_fim: salvo.agenda_hora_fim,
            agenda_duracao_padrao: salvo.agenda_duracao_padrao,
          },
        } as Usuario);
      }
      toast.success("Agenda atualizada.", {
        description: "As visões de dia e semana já mostram só essa faixa.",
      });
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setSalvando(false);
    }
  };

  const selectClass =
    "bg-background text-foreground border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <section
      data-testid="expediente-section"
      className="bg-card shadow-elevacao border border-border rounded-xl p-6"
    >
      <h2 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
        <Clock className="w-4 h-4 text-brand-accent" />
        Expediente
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        Como a empresa trabalha. O expediente recorta as visões de dia e
        semana da Agenda — nenhum compromisso fora dela é escondido — e a
        duração vale para o evento criado clicando num horário livre.
      </p>

      {!isAdmin && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-alerta">
          Apenas administradores podem alterar o expediente.
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label
            htmlFor="expediente-inicio"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Começa às
          </label>
          <select
            id="expediente-inicio"
            value={inicio}
            disabled={!isAdmin}
            onChange={(e) => setInicio(Number(e.target.value))}
            className={selectClass}
          >
            {HORAS_INICIO.map((h) => (
              <option key={h} value={h}>
                {rotuloHora(h)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="expediente-fim"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Termina às
          </label>
          <select
            id="expediente-fim"
            value={fim}
            disabled={!isAdmin}
            onChange={(e) => setFim(Number(e.target.value))}
            className={selectClass}
          >
            {HORAS_FIM.map((h) => (
              <option key={h} value={h}>
                {rotuloHora(h)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="expediente-duracao"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Evento novo dura
          </label>
          <select
            id="expediente-duracao"
            value={duracao}
            disabled={!isAdmin}
            onChange={(e) => setDuracao(Number(e.target.value))}
            className={selectClass}
          >
            {DURACOES.map((m) => (
              <option key={m} value={m}>
                {rotuloDuracao(m)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={salvar}
          disabled={!isAdmin || salvando || !mudou || invertido}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar
        </button>
      </div>

      {invertido && (
        <p className="mt-3 text-sm text-erro">
          O expediente precisa terminar depois de começar.
        </p>
      )}
    </section>
  );
}

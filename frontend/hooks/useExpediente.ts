"use client";
/**
 * O expediente da empresa, como o calendário precisa dele.
 *
 * O react-big-calendar recebe `min` e `max` como Date — só a HORA importa,
 * o dia é ignorado. Aqui as horas cheias que vêm do `/auth/me` viram esse
 * par, com o padrão valendo enquanto a empresa não carregou (senão a grade
 * piscaria de 24h para o expediente assim que o usuário chegasse).
 */
import { useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { EXPEDIENTE_PADRAO } from "@/types/auth";

/** Uma hora cheia virada em Date — o dia não importa para o `min`/`max`. */
export function horaComoData(hora: number): Date {
  const d = new Date(2000, 0, 1, 0, 0, 0, 0);
  // 24 quer dizer "até o fim do dia": 23:59, não 00:00 do dia seguinte, que
  // o calendário leria como um intervalo vazio.
  if (hora >= 24) {
    d.setHours(23, 59, 59, 999);
    return d;
  }
  d.setHours(Math.max(0, hora), 0, 0, 0);
  return d;
}

export function useExpediente(): { min: Date; max: Date } {
  const usuario = useAppStore((s) => s.usuario);
  const inicio = usuario?.empresa?.agenda_hora_inicio ?? EXPEDIENTE_PADRAO.inicio;
  const fim = usuario?.empresa?.agenda_hora_fim ?? EXPEDIENTE_PADRAO.fim;

  return useMemo(
    () => ({ min: horaComoData(inicio), max: horaComoData(fim) }),
    [inicio, fim]
  );
}

/**
 * O expediente que o calendário recebe.
 *
 * As horas cheias que vêm do /auth/me viram o par `min`/`max` que o
 * react-big-calendar entende. O que importa: o padrão vale enquanto a empresa
 * não carregou (senão a grade piscaria de 24h para o expediente), e "24h" quer
 * dizer fim do dia, não meia-noite do dia seguinte.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import {
  horaComoData,
  useDuracaoPadrao,
  useExpediente,
} from "./useExpediente";
import { useAppStore } from "@/store/useAppStore";
import type { Usuario } from "@/types/auth";

function setEmpresa(agenda_hora_inicio?: number, agenda_hora_fim?: number) {
  useAppStore.setState({
    usuario: {
      id: "u1",
      perfil: "admin",
      empresa:
        agenda_hora_inicio === undefined
          ? null
          : { id: "e1", agenda_hora_inicio, agenda_hora_fim },
    } as unknown as Usuario,
  });
}

beforeEach(() => useAppStore.setState({ usuario: null }));

describe("horaComoData", () => {
  it("vira a hora cheia pedida", () => {
    expect(horaComoData(7).getHours()).toBe(7);
    expect(horaComoData(7).getMinutes()).toBe(0);
  });

  it("meia-noite é zero, não o dia seguinte", () => {
    expect(horaComoData(0).getHours()).toBe(0);
  });

  it("24h quer dizer o FIM do dia", () => {
    // 00:00 do dia seguinte seria lido como intervalo vazio pelo calendário.
    const d = horaComoData(24);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
  });

  it("o dia não importa — só a hora", () => {
    expect(horaComoData(9).getDate()).toBe(horaComoData(18).getDate());
  });
});

describe("useExpediente", () => {
  it("usa o expediente da empresa", () => {
    setEmpresa(9, 18);

    const { result } = renderHook(() => useExpediente());

    expect(result.current.min.getHours()).toBe(9);
    expect(result.current.max.getHours()).toBe(18);
  });

  it("sem empresa carregada, usa o padrão comercial", () => {
    // Nada de piscar 24h de grade antes de o /auth/me chegar.
    setEmpresa(undefined);

    const { result } = renderHook(() => useExpediente());

    expect(result.current.min.getHours()).toBe(7);
    expect(result.current.max.getHours()).toBe(20);
  });

  it("empresa que trabalha de madrugada é respeitada", () => {
    setEmpresa(0, 8);

    const { result } = renderHook(() => useExpediente());

    expect(result.current.min.getHours()).toBe(0);
    expect(result.current.max.getHours()).toBe(8);
  });
});

describe("useDuracaoPadrao", () => {
  it("usa a duração que a empresa configurou", () => {
    setEmpresa(7, 20);
    useAppStore.setState({
      usuario: {
        id: "u1",
        empresa: {
          id: "e1",
          agenda_hora_inicio: 7,
          agenda_hora_fim: 20,
          agenda_duracao_padrao: 30,
        },
      } as unknown as Usuario,
    });

    const { result } = renderHook(() => useDuracaoPadrao());

    expect(result.current).toBe(30);
  });

  it("sem empresa carregada, uma hora", () => {
    setEmpresa(undefined);

    const { result } = renderHook(() => useDuracaoPadrao());

    expect(result.current).toBe(60);
  });
});

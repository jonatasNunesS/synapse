/**
 * Landing — se GET /api/planos/ falhar, a seção de planos continua de pé com
 * o fallback estático (os três cartões, todos "preço a definir").
 *
 * Fica num arquivo só para esse caso: a rejeição precisa ser a implementação
 * do mock desde a criação, senão o rastreio de mocks do vitest acusa a
 * rejeição como não tratada mesmo com o hook tratando.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const get = vi.fn((_url: string) =>
  Promise.reject(new Error("backend fora do ar"))
);
vi.mock("@/lib/api", async () => {
  const real = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...real, api: { get: (url: string) => get(url) } };
});

import { PlanosSection } from "./PlanosSection";

describe("Landing — planos com a API fora do ar", () => {
  it("mostra os três cartões e 'preço a definir'", async () => {
    render(<PlanosSection />);

    await waitFor(() => expect(get).toHaveBeenCalledWith("/planos/"));
    expect(
      screen.getByText("Os três planos vêm com o sistema completo")
    ).toBeInTheDocument();
    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Business")).toBeInTheDocument();
    expect(screen.getAllByText("preço a definir")).toHaveLength(3);
    // Os botões de cadastro continuam apontando para /registro
    expect(screen.getAllByRole("link", { name: "Começar" })).toHaveLength(3);
  });
});

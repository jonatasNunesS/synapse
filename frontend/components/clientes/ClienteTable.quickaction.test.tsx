/**
 * Parte 4: o botão de ação rápida "Nova interação" aparece por cliente na
 * lista e dispara onNovaInteracao com o cliente da linha.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClienteTable } from "./ClienteTable";
import type { ClienteList } from "@/types/clientes";

const cliente: ClienteList = {
  id: "c1", nome: "Ana & João", tipo: "pessoa_fisica", tipo_display: "PF",
  email: null, telefone: null, whatsapp: null, status_funil: "lead",
  status_funil_display: "Lead", origem: null, origem_display: "",
  valor_total_compras: "500.00", valor_recebido: "300.00", valor_a_receber: "200.00",
  quantidade_compras: 1, ultima_compra: null, ticket_medio: "500.00",
  followup_atrasado: false, proximo_followup: null, ativo: true,
  link_whatsapp: "", criado_em: "2026-07-22T10:00:00Z",
} as unknown as ClienteList;

describe("ClienteTable — atalho de interação", () => {
  it("mostra o botão por cliente e dispara onNovaInteracao", () => {
    const onNovaInteracao = vi.fn();
    render(
      <ClienteTable clientes={[cliente]} onNovaInteracao={onNovaInteracao} />
    );
    const btn = screen.getByRole("button", { name: "Nova interação para Ana & João" });
    fireEvent.click(btn);
    expect(onNovaInteracao).toHaveBeenCalledWith(cliente);
  });

  it("sem o callback, o botão por cliente não aparece", () => {
    render(<ClienteTable clientes={[cliente]} />);
    expect(
      screen.queryByRole("button", { name: /Nova interação para/ })
    ).not.toBeInTheDocument();
  });
});

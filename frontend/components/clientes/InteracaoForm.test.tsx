/**
 * Modal de interação em modo edição: pré-preenche os campos com os dados
 * atuais e usa o rótulo "Salvar alterações". No modo criação, "Registrar".
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InteracaoForm } from "./InteracaoForm";
import type { InteracaoCliente } from "@/types/clientes";

const interacao: InteracaoCliente = {
  id: "int-1",
  tipo: "venda",
  tipo_display: "Venda",
  titulo: "Venda inicial",
  descricao: "Primeira compra",
  valor: "500.00",
  data_interacao: "2026-07-20T14:30:00Z",
  proximo_followup: null,
  criado_por_nome: "Maria",
  criado_em: "2026-07-20T14:30:00Z",
};

describe("InteracaoForm — modo edição", () => {
  it("abre pré-preenchido com os dados da interação", () => {
    render(
      <InteracaoForm interacao={interacao} onSubmit={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText("Editar Interação")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Venda inicial")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Primeira compra")).toBeInTheDocument();
    expect(screen.getByDisplayValue("500.00")).toBeInTheDocument();
  });

  it('usa o botão "Salvar alterações"', () => {
    render(
      <InteracaoForm interacao={interacao} onSubmit={vi.fn()} onClose={vi.fn()} />
    );
    expect(
      screen.getByRole("button", { name: /Salvar alterações/i })
    ).toBeInTheDocument();
  });

  it('no modo criação usa "Registrar" e não pré-preenche o título', () => {
    render(<InteracaoForm onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Registrar Interação")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Registrar/i })
    ).toBeInTheDocument();
  });
});

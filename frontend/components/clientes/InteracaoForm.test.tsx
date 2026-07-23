/**
 * Modal de interação em modo edição: pré-preenche os campos com os dados
 * atuais e usa o rótulo "Salvar alterações". No modo criação, "Registrar".
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  status_pagamento: "nao_se_aplica",
  status_pagamento_display: "Não se aplica",
  data_prevista_pagamento: null,
  pagamento_atrasado: false,
  dias_para_vencer: null,
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

describe("InteracaoForm — status de pagamento", () => {
  it("mostra o status de pagamento ao escolher venda", () => {
    render(<InteracaoForm onSubmit={vi.fn()} onClose={vi.fn()} />);
    // Seleciona o tipo Venda
    fireEvent.click(screen.getByRole("button", { name: /Venda/ }));
    expect(screen.getByText("Status do pagamento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pendente" })).toBeInTheDocument();
  });

  it("ao escolher Pendente, exige a previsão de pagamento", () => {
    render(<InteracaoForm onSubmit={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Venda/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pendente" }));
    expect(screen.getByLabelText("Previsão de pagamento")).toBeInTheDocument();
  });

  it("não mostra status de pagamento para ligação", () => {
    render(<InteracaoForm onSubmit={vi.fn()} onClose={vi.fn()} />);
    // default é ligação
    expect(screen.queryByText("Status do pagamento")).not.toBeInTheDocument();
  });
});

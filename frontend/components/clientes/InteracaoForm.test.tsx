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

describe("InteracaoForm — venda deixou de ser um tipo de interação", () => {
  /**
   * Venda se registra na tela de Vendas, que tem itens, estoque e
   * financeiro. As métricas do cliente leem `Venda` e só ela — deixar a
   * porta antiga aberta seria dinheiro entrando por um caminho que nenhum
   * número enxerga, que é o defeito que esta leva fecha (B10).
   *
   * Os dois primeiros testes aqui afirmavam o contrário, e estavam certos
   * até agora: escolher "Venda" abria valor e status de pagamento.
   */
  it("não oferece Venda ao registrar uma interação nova", () => {
    render(<InteracaoForm onSubmit={vi.fn()} onClose={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /^Venda$/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Ligação/ })).toBeInTheDocument();
  });

  it("não mostra status de pagamento para ligação", () => {
    render(<InteracaoForm onSubmit={vi.fn()} onClose={vi.fn()} />);
    // default é ligação
    expect(screen.queryByText("Status do pagamento")).not.toBeInTheDocument();
  });

  it("editando uma venda antiga, o tipo aparece marcado e os campos dela também", () => {
    // Tirar o tipo da existência faria o formulário recusar um registro que
    // o próprio sistema gravou. Ele aparece — e não dá para escolher.
    render(
      <InteracaoForm interacao={interacao} onSubmit={vi.fn()} onClose={vi.fn()} />
    );

    const botaoVenda = screen.getByRole("button", { name: /^Venda$/ });
    expect(botaoVenda).toBeInTheDocument();
    expect(botaoVenda).toBeDisabled();
    expect(screen.getByText("Status do pagamento")).toBeInTheDocument();
    expect(screen.getByDisplayValue("500.00")).toBeInTheDocument();
  });

  it("ao marcar Pendente numa venda antiga, exige a previsão de pagamento", () => {
    render(
      <InteracaoForm interacao={interacao} onSubmit={vi.fn()} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Pendente" }));
    expect(screen.getByLabelText("Previsão de pagamento")).toBeInTheDocument();
  });
});

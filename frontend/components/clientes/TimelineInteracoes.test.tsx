/**
 * Timeline de interações: cada item mostra as ações de editar e apagar, e
 * clicá-las dispara os callbacks corretos (a página abre o modal / o
 * ConfirmDialog a partir daí).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TimelineInteracoes } from "./TimelineInteracoes";
import type { InteracaoCliente } from "@/types/clientes";

const interacao: InteracaoCliente = {
  id: "int-1",
  tipo: "ligacao",
  tipo_display: "Ligação",
  titulo: "Ligação de apresentação",
  descricao: "Falamos sobre o produto",
  valor: null,
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

describe("TimelineInteracoes", () => {
  it("mostra os botões de editar e apagar em cada interação", () => {
    render(
      <TimelineInteracoes
        interacoes={[interacao]}
        onEditar={vi.fn()}
        onApagar={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: "Editar interação" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Excluir interação" })
    ).toBeInTheDocument();
  });

  it("clicar em editar dispara onEditar com a interação", () => {
    const onEditar = vi.fn();
    render(
      <TimelineInteracoes interacoes={[interacao]} onEditar={onEditar} onApagar={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Editar interação" }));
    expect(onEditar).toHaveBeenCalledWith(interacao);
  });

  it("clicar em apagar dispara onApagar com a interação (não deleta direto)", () => {
    const onApagar = vi.fn();
    render(
      <TimelineInteracoes interacoes={[interacao]} onEditar={vi.fn()} onApagar={onApagar} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir interação" }));
    expect(onApagar).toHaveBeenCalledWith(interacao);
  });

  it("sem interações mostra o estado vazio", () => {
    render(<TimelineInteracoes interacoes={[]} />);
    expect(screen.getByText("Nenhuma interação registrada.")).toBeInTheDocument();
  });

  it("sem callbacks, os botões de ação não aparecem", () => {
    render(<TimelineInteracoes interacoes={[interacao]} />);
    const item = screen.getByText("Ligação de apresentação").closest("div")!;
    expect(
      within(item.parentElement as HTMLElement).queryByRole("button", {
        name: "Editar interação",
      })
    ).not.toBeInTheDocument();
  });
});

describe("TimelineInteracoes — badge de pagamento", () => {
  function venda(over: Partial<InteracaoCliente>): InteracaoCliente {
    return { ...interacao, id: "v", tipo: "venda", tipo_display: "Venda",
      titulo: "Venda", valor: "500.00", ...over };
  }

  it('badge verde "Pago"', () => {
    render(<TimelineInteracoes interacoes={[venda({ status_pagamento: "pago", status_pagamento_display: "Pago" })]} />);
    expect(screen.getByText("Pago")).toBeInTheDocument();
  });

  it('badge vermelho "Atrasado" para pendente vencida', () => {
    render(<TimelineInteracoes interacoes={[venda({
      status_pagamento: "pendente", pagamento_atrasado: true, dias_para_vencer: -2,
    })]} />);
    expect(screen.getByText("Atrasado")).toBeInTheDocument();
  });

  it('badge "Vence em N dias" para pendente futura', () => {
    render(<TimelineInteracoes interacoes={[venda({
      status_pagamento: "pendente", pagamento_atrasado: false, dias_para_vencer: 3,
    })]} />);
    expect(screen.getByText("Vence em 3 dias")).toBeInTheDocument();
  });

  it("sem badge quando nao_se_aplica", () => {
    render(<TimelineInteracoes interacoes={[venda({ status_pagamento: "nao_se_aplica" })]} />);
    expect(screen.queryByText("Pago")).not.toBeInTheDocument();
    expect(screen.queryByText("Pendente")).not.toBeInTheDocument();
    expect(screen.queryByText(/Vence/)).not.toBeInTheDocument();
  });
});

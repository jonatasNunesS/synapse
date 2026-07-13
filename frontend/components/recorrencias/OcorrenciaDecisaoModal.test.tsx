/**
 * Testes do modal de decisão de ocorrência.
 * Cobre: renderiza os 4 botões; "Editar valor" abre o input e, ao continuar,
 * mostra o modal "atualizar recorrência?".
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Evita chamadas de rede reais das ações.
vi.mock("@/hooks/useRecorrencias", () => ({
  confirmarOcorrencia: vi.fn(),
  adiarOcorrencia: vi.fn(),
  cancelarOcorrencia: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { OcorrenciaDecisaoModal } from "./OcorrenciaDecisaoModal";
import type { OcorrenciaDetalhe } from "@/types/recorrencias";

const oc: OcorrenciaDetalhe = {
  id: "oc-1",
  recorrencia: "r-1",
  recorrencia_titulo: "Salário Patrícia",
  recorrencia_tipo: "receita",
  valor_esperado: "3000.00",
  data_esperada: "2026-07-05",
  status: "pendente",
  valor_confirmado: null,
  data_confirmacao: null,
  data_adiada_para: null,
  lancamento_gerado: null,
};

const noop = () => {};

describe("OcorrenciaDecisaoModal", () => {
  it("renderiza os 4 botões de decisão", () => {
    render(<OcorrenciaDecisaoModal ocorrencia={oc} onClose={noop} onResolved={noop} />);
    expect(screen.getByText("Confirmar")).toBeInTheDocument();
    expect(screen.getByText("Editar valor")).toBeInTheDocument();
    expect(screen.getByText("Adiar")).toBeInTheDocument();
    expect(screen.getByText("Cancelar mês")).toBeInTheDocument();
    // Mostra o valor e a data esperados
    expect(screen.getByText(/Salário Patrícia/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*3\.000,00/)).toBeInTheDocument();
  });

  it("Editar valor abre o input e, ao continuar, pergunta se atualiza a recorrência", () => {
    render(<OcorrenciaDecisaoModal ocorrencia={oc} onClose={noop} onResolved={noop} />);
    fireEvent.click(screen.getByText("Editar valor"));

    const input = screen.getByRole("spinbutton"); // input type=number
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "3500" } });
    fireEvent.click(screen.getByText("Continuar"));

    // Modal de decisão "atualizar recorrência?"
    expect(
      screen.getByText(/Deseja atualizar o valor da recorrência/)
    ).toBeInTheDocument();
    expect(screen.getByText("Sim, atualizar")).toBeInTheDocument();
    expect(screen.getByText("Não, só esse mês")).toBeInTheDocument();
  });

  it("Adiar abre o input de dias", () => {
    render(<OcorrenciaDecisaoModal ocorrencia={oc} onClose={noop} onResolved={noop} />);
    fireEvent.click(screen.getByText("Adiar"));
    expect(screen.getByText(/Adiar por quantos dias/)).toBeInTheDocument();
  });
});

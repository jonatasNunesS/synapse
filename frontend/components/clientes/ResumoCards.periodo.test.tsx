/**
 * ResumoCards em modo período: mostra o rótulo "julho 2026", o comparativo
 * "+3 novos vs junho" e troca os KPIs para os valores do período.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResumoCards } from "./ResumoCards";
import type { ResumoClientes } from "@/types/clientes";

const base: ResumoClientes = {
  total_clientes: 10,
  clientes_ativos: 8,
  novos_este_mes: 5,
  valor_total_vendas: "5000.00",
  ticket_medio: "500.00",
  followups_hoje: 1,
  followups_atrasados: 2,
  por_status: {} as ResumoClientes["por_status"],
  por_origem: {},
};

const comPeriodo: ResumoClientes = {
  ...base,
  periodo: { mes: 7, ano: 2026, label: "julho 2026" },
  novos_no_periodo: 3,
  valor_gerado_no_periodo: "900.00",
  comparativo: { novos_mes_anterior: 0, novos_diff: 3, mes_anterior_label: "junho" },
};

describe("ResumoCards — período", () => {
  it("sem período: não mostra o rótulo nem o comparativo", () => {
    render(<ResumoCards resumo={base} />);
    expect(screen.queryByText("julho 2026")).not.toBeInTheDocument();
    expect(screen.getByText("Novos este Mês")).toBeInTheDocument();
  });

  it("com período: mostra rótulo, comparativo e KPIs do período", () => {
    render(<ResumoCards resumo={comPeriodo} periodoAtivo />);
    expect(screen.getByText("julho 2026")).toBeInTheDocument();
    // "+3 novos vs junho" aparece (banner + subtítulo do card)
    expect(screen.getAllByText("+3 novos vs junho").length).toBeGreaterThan(0);
    expect(screen.getByText("Novos no Período")).toBeInTheDocument();
    expect(screen.getByText("Receita no Período")).toBeInTheDocument();
    // Receita do período formatada
    expect(screen.getByText("R$ 900,00")).toBeInTheDocument();
  });
});

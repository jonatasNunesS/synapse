/**
 * Testes do SaldoResumo — os KPIs do Financeiro.
 * Cobre: renderiza os dois saldos + as 4 métricas; sinal/cor por resultado
 * (positivo verde / negativo vermelho); clicar num card dispara o filtro.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SaldoResumo } from "./SaldoResumo";
import type { SaldoFinanceiro } from "@/types/financeiro";

const saldo: SaldoFinanceiro = {
  acumulado: { total_recebido: 45000, total_pago: 24500, saldo: 20500 },
  mes_atual: {
    mes: 7,
    ano: 2026,
    saldo: 3200,
    recebido: { total: 8000, count: 5 },
    a_receber: { total: 2000, count: 2 },
    pago: { total: 4800, count: 7 },
    a_pagar: { total: 1500, count: 3 },
  },
};

describe("SaldoResumo", () => {
  it("renderiza os dois saldos e as quatro métricas", () => {
    render(<SaldoResumo saldo={saldo} />);
    expect(screen.getByText("Saldo acumulado")).toBeInTheDocument();
    expect(screen.getByText(/Saldo do mês/)).toBeInTheDocument();
    // Rótulos das 4 métricas
    ["Recebido", "A receber", "Pago", "A pagar"].forEach((t) =>
      expect(screen.getByText(t)).toBeInTheDocument()
    );
    // Contagens
    expect(screen.getByText("5 lançamentos")).toBeInTheDocument();
    expect(screen.getByText("2 lançamentos")).toBeInTheDocument();
    expect(screen.getByText("7 lançamentos")).toBeInTheDocument();
    expect(screen.getByText("3 lançamentos")).toBeInTheDocument();
  });

  it("saldo positivo aparece verde; negativo aparece vermelho", () => {
    const { rerender } = render(<SaldoResumo saldo={saldo} />);
    const acumulado = screen.getByText("Saldo acumulado").parentElement!
      .parentElement!;
    expect(within(acumulado).getByText(/R\$/)).toHaveClass("text-emerald-400");

    // Mês deficitário → vermelho e com sinal negativo preservado
    const negativo: SaldoFinanceiro = {
      ...saldo,
      mes_atual: { ...saldo.mes_atual, saldo: -1200 },
    };
    rerender(<SaldoResumo saldo={negativo} />);
    const mesBox = screen.getByText(/Saldo do mês/).parentElement!.parentElement!;
    const valor = within(mesBox).getByText(/R\$/);
    expect(valor).toHaveClass("text-red-400");
  });

  it("clicar num card dispara onFiltrar com tipo+status; clicar de novo limpa", () => {
    const onFiltrar = vi.fn();
    render(<SaldoResumo saldo={saldo} onFiltrar={onFiltrar} />);
    // "A receber" = receita + pendente
    fireEvent.click(screen.getByText("A receber"));
    expect(onFiltrar).toHaveBeenCalledWith({ tipo: "receita", status: "pendente" });

    // Com o card já ativo, clicar de novo limpa (null)
    onFiltrar.mockClear();
    render(
      <SaldoResumo
        saldo={saldo}
        onFiltrar={onFiltrar}
        filtroAtivo={{ tipo: "receita", status: "pendente" }}
      />
    );
    fireEvent.click(screen.getAllByText("A receber")[1]);
    expect(onFiltrar).toHaveBeenCalledWith(null);
  });

  it("estado loading não quebra (sem dados ainda)", () => {
    render(<SaldoResumo saldo={null} loading />);
    expect(screen.getByText("Saldo acumulado")).toBeInTheDocument();
  });
});

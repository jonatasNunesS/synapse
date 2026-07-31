/**
 * Seletor de período: aplica quando Mês E Ano estão preenchidos; "Limpar"
 * volta ao estado sem filtro.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PeriodoSelector } from "./PeriodoSelector";

describe("PeriodoSelector", () => {
  it("aplica período ao escolher mês e ano", () => {
    const onChange = vi.fn();
    render(<PeriodoSelector periodo={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "7" } });
    // ano assume o atual ao escolher só o mês → já dispara com {mes:7, ano:atual}
    expect(onChange).toHaveBeenCalled();
    const ultimo = onChange.mock.calls.at(-1)![0];
    expect(ultimo.mes).toBe(7);
    expect(ultimo.ano).toBeGreaterThan(2000);
  });

  it('"Limpar" só aparece com período ativo e zera o filtro', () => {
    const onChange = vi.fn();
    const { rerender } = render(<PeriodoSelector periodo={null} onChange={onChange} />);
    expect(screen.queryByText("Limpar")).not.toBeInTheDocument();

    rerender(<PeriodoSelector periodo={{ mes: 7, ano: 2026 }} onChange={onChange} />);
    fireEvent.click(screen.getByText("Limpar"));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

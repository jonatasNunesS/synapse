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
  // Sem caixinhas: disponível = acumulado (retrocompatível)
  caixinhas: { total: 0, quantidade: 0 },
  saldo_disponivel: 20500,
  patrimonio_total: 20500,
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

  it("com caixinhas: mostra saldo disponível, link e patrimônio total", () => {
    // Exemplo da spec: acumulado 10.000, caixinha 2.000 → disponível 8.000
    const comCaixinhas: SaldoFinanceiro = {
      ...saldo,
      acumulado: { ...saldo.acumulado, saldo: 10000 },
      caixinhas: { total: 2000, quantidade: 1 },
      saldo_disponivel: 8000,
      patrimonio_total: 10000,
    };
    render(<SaldoResumo saldo={comCaixinhas} />);
    expect(screen.getByText("Saldo disponível")).toBeInTheDocument();
    expect(screen.queryByText("Saldo acumulado")).not.toBeInTheDocument();
    // Valor escopado no card do saldo (R$ 8.000,00 também é a métrica "Recebido")
    const box = screen.getByText("Saldo disponível").parentElement!.parentElement!;
    expect(within(box).getByText(/R\$\s*8\.000,00/)).toBeInTheDocument();
    // Rótulos (currency usa nbsp — casamos só o texto do rótulo)
    expect(screen.getByText(/Em caixinhas:/)).toBeInTheDocument();
    expect(screen.getByText(/Patrimônio total:/)).toBeInTheDocument();
    // O link leva para a página de caixinhas
    expect(
      screen.getByText(/Em caixinhas/).closest("a")
    ).toHaveAttribute("href", "/financeiro/caixinhas");
  });

  it("linha discreta de empréstimos NÃO aparece sem empréstimos", () => {
    render(<SaldoResumo saldo={saldo} />);
    expect(screen.queryByText(/Emprestado:/)).not.toBeInTheDocument();
    // mantém a legenda padrão do saldo acumulado
    expect(
      screen.getByText(/Dinheiro real disponível hoje/)
    ).toBeInTheDocument();
  });

  it("linha discreta aparece com empréstimos e leva pra /financeiro/emprestimos", () => {
    const comEmprestimo: SaldoFinanceiro = {
      ...saldo,
      emprestimos: { a_receber: 500, a_devolver: 0, quantidade: 1 },
    };
    render(<SaldoResumo saldo={comEmprestimo} />);
    const link = screen.getByText(/Emprestado:/).closest("a");
    expect(link).toHaveAttribute("href", "/financeiro/emprestimos");
    // "a devolver" oculto quando é zero
    expect(screen.queryByText(/A devolver:/)).not.toBeInTheDocument();
  });

  it("caixinhas E empréstimos convivem sob o saldo disponível", () => {
    // Resultado esperado do rebase: as duas informações juntas.
    const comAmbos: SaldoFinanceiro = {
      ...saldo,
      acumulado: { ...saldo.acumulado, saldo: 12000 },
      caixinhas: { total: 2000, quantidade: 1 },
      saldo_disponivel: 9500,
      patrimonio_total: 12000,
      emprestimos: { a_receber: 500, a_devolver: 0, quantidade: 1 },
    };
    render(<SaldoResumo saldo={comAmbos} />);
    expect(screen.getByText("Saldo disponível")).toBeInTheDocument();
    // ambas as informações discretas presentes, cada uma com seu link
    expect(screen.getByText(/Em caixinhas/).closest("a")).toHaveAttribute(
      "href",
      "/financeiro/caixinhas"
    );
    expect(screen.getByText(/Emprestado:/).closest("a")).toHaveAttribute(
      "href",
      "/financeiro/emprestimos"
    );
    expect(screen.getByText(/Patrimônio total:/)).toBeInTheDocument();
  });
});

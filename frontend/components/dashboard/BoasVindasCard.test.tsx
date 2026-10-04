/**
 * O cartão de destaque do dashboard — o lugar onde o número errado é mais
 * lido e menos questionado.
 *
 * É a primeira coisa na tela, em roxo, em negrito: "Saldo do mês: R$ 0,00".
 * Quando o bloco financeiro não respondia, era esse zero que o fundador lia
 * de manhã. A pílula agora não aparece, e o aviso explícito fica nos KPIs
 * logo abaixo, onde há espaço para dizer o que aconteceu.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { BoasVindasCard } from "./BoasVindasCard";
import type { DashboardResumo } from "@/types/dashboard";

function resumo(over: Partial<DashboardResumo> = {}): DashboardResumo {
  return {
    financeiro: {
      total_receitas: 5000,
      total_despesas: 2000,
      saldo_mes: 3000,
      total_pendente: 0,
      total_atrasado: 0,
      lancamentos_count: 4,
    },
    estoque: null,
    crm: null,
    projetos: {
      total_projetos: 2,
      projetos_ativos: 1,
      projetos_atrasados: 0,
      tarefas_pendentes: 3,
      tarefas_minhas: 2,
      tarefas_atrasadas: 0,
      projetos_por_status: {},
    },
    equipe: null,
    notificacoes: { nao_lidas: 0 },
    meta: { mes: 10, ano: 2026, gerado_em: "2026-10-04" },
    ...over,
  };
}

describe("Saldo do mês", () => {
  it("com saldo real, mostra o valor", () => {
    render(<BoasVindasCard resumo={resumo()} nomeUsuario="Jonatas Nunes" />);

    expect(screen.getByText("Saldo do mês")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*3\.000,00/)).toBeInTheDocument();
  });

  it("saldo zero de verdade continua aparecendo como R$ 0,00", () => {
    render(
      <BoasVindasCard
        resumo={resumo({
          financeiro: {
            total_receitas: 0,
            total_despesas: 0,
            saldo_mes: 0,
            total_pendente: 0,
            total_atrasado: 0,
            lancamentos_count: 0,
          },
        })}
        nomeUsuario="Jonatas"
      />
    );

    // Mês fechado em zero é informação, e some da tela se eu confundir
    // ausência com zero no sentido contrário.
    expect(screen.getByText("Saldo do mês")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*0,00/)).toBeInTheDocument();
  });

  it("bloco financeiro indisponível esconde a pílula em vez de dizer zero", () => {
    render(
      <BoasVindasCard resumo={resumo({ financeiro: null })} nomeUsuario="Jonatas" />
    );

    expect(screen.queryByText("Saldo do mês")).not.toBeInTheDocument();
    expect(screen.queryByText(/R\$\s*0,00/)).not.toBeInTheDocument();
    // O resto do cartão continua: a saudação não depende do financeiro.
    expect(screen.getByText(/Jonatas/)).toBeInTheDocument();
    expect(screen.getByText(/Resumo de Outubro de 2026/)).toBeInTheDocument();
  });
});

describe("Minhas tarefas", () => {
  it("mostra a contagem quando o bloco respondeu", () => {
    render(<BoasVindasCard resumo={resumo()} nomeUsuario="Jonatas" />);
    expect(screen.getByText("2 pendentes")).toBeInTheDocument();
  });

  it("bloco de projetos indisponível não inventa 'pendentes'", () => {
    render(
      <BoasVindasCard resumo={resumo({ projetos: null })} nomeUsuario="Jonatas" />
    );
    expect(screen.queryByText(/pendente/)).not.toBeInTheDocument();
  });
});

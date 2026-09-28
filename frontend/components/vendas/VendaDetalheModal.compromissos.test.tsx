/**
 * O detalhe da venda mostra os compromissos vinculados a ela.
 *
 * A venda não tem página própria: este modal É o detalhe dela, então é aqui
 * que a seção mora.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { VendaDetalheModal } from "./VendaDetalheModal";
import type { Evento } from "@/types/agenda";
import type { Venda } from "@/types/vendas";

/** Eventos que o hook devolve nesta renderização. */
let eventos: Evento[] = [];
const carregar = vi.fn().mockResolvedValue([]);
/** Qual venda o hook recebeu — é o que prova que o filtro é por ESTA venda. */
let vendaPedida: string | null = null;
vi.mock("@/hooks/useAgenda", () => ({
  useEventosDaVenda: (id: string | null) => {
    vendaPedida = id;
    return {
      eventos,
      loading: false,
      error: null,
      carregadoEm: new Date("2026-10-05T12:00:00.000Z").getTime(),
      carregar,
    };
  },
}));

/** Módulos ligados nesta renderização. */
let agendaLigada = true;
vi.mock("@/hooks/useModulos", () => ({
  useModulos: () => ({
    moduloAtivo: (m: string) => (m === "agenda" ? agendaLigada : true),
  }),
}));

function venda(over: Partial<Venda> = {}): Venda {
  return {
    id: "v1",
    cliente: "c1",
    cliente_nome: "Ana Paula",
    data_venda: "2026-10-05",
    subtotal: "150.00",
    desconto: "0.00",
    total: "150.00",
    forma_pagamento: "pix",
    status_pagamento: "pago",
    data_prevista_pagamento: null,
    devedor: "",
    valor_recebido: "150.00",
    saldo_devedor: "0.00",
    // O modal percorre os itens; venda sem linha nenhuma é caso válido aqui,
    // porque o que se testa é a seção de compromissos, não a lista de itens.
    itens: [],
    ...over,
  } as Venda;
}

function evento(over: Partial<Evento> = {}): Evento {
  return {
    id: "e1", titulo: "Entrega do pedido", descricao: "",
    data_inicio: "2026-10-06T14:00:00.000Z",
    data_fim: "2026-10-06T15:00:00.000Z",
    dia_inteiro: false, local: "", cor: "#6D28D9", cor_efetiva: "#6D28D9",
    categoria: null, categoria_nome: null,
    projeto: null, projeto_nome: null, venda: "v1", venda_rotulo: "Venda de 05/10/2026",
    lembrete_antecedencia: 0,
    cliente: null, cliente_nome: null, criado_por: null, criado_por_nome: null,
    criado_em: "", atualizado_em: "",
    ...over,
  };
}

beforeEach(() => {
  eventos = [];
  agendaLigada = true;
  vendaPedida = null;
  carregar.mockClear();
});

describe("Compromissos da venda", () => {
  it("mostra os eventos vinculados", async () => {
    eventos = [evento()];
    render(<VendaDetalheModal venda={venda()} onClose={vi.fn()} />);

    expect(await screen.findByTestId("compromissos-vinculados")).toBeInTheDocument();
    expect(screen.getByText("Entrega do pedido")).toBeInTheDocument();
  });

  it("pede os eventos DESTA venda", async () => {
    render(<VendaDetalheModal venda={venda({ id: "v42" })} onClose={vi.fn()} />);

    await waitFor(() => expect(carregar).toHaveBeenCalled());
    expect(vendaPedida).toBe("v42");
  });

  it("venda sem compromisso explica em vez de ficar em branco", async () => {
    render(<VendaDetalheModal venda={venda()} onClose={vi.fn()} />);

    expect(
      await screen.findByText("Nenhum compromisso nesta venda.")
    ).toBeInTheDocument();
  });

  it("sem o módulo Agenda, a seção não aparece", async () => {
    agendaLigada = false;
    eventos = [evento()];
    render(<VendaDetalheModal venda={venda()} onClose={vi.fn()} />);

    // O modal continua inteiro — só a seção da agenda é que sai.
    expect(await screen.findByText("Venda")).toBeInTheDocument();
    expect(screen.queryByTestId("compromissos-vinculados")).not.toBeInTheDocument();
  });

  it("sem o módulo, nem vai buscar os eventos", async () => {
    agendaLigada = false;
    render(<VendaDetalheModal venda={venda()} onClose={vi.fn()} />);

    await screen.findByText("Venda");
    expect(carregar).not.toHaveBeenCalled();
  });

  it("falhar ao carregar não derruba o detalhe da venda", async () => {
    carregar.mockRejectedValueOnce(new Error("rede caiu"));
    render(<VendaDetalheModal venda={venda()} onClose={vi.fn()} />);

    // O que o modal existe para mostrar continua na tela. (O total aparece em
    // mais de um lugar — subtotal e total — daí o `findAllByText`.)
    expect((await screen.findAllByText("R$ 150,00")).length).toBeGreaterThan(0);
    expect(screen.getByText("Venda")).toBeInTheDocument();
  });
});

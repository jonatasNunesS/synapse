/**
 * O atalho de registrar sem sair da tela.
 *
 * Duas coisas importam aqui e o resto é consequência: o menu não pode oferecer
 * um módulo que a empresa desligou, e o formulário que abre precisa ser o do
 * módulo — não uma cópia que amanhã fica para trás.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { BotaoAcaoRapida, ACOES } from "./BotaoAcaoRapida";
import type { ModuloOpcional } from "@/types/auth";

// Cada ação monta o formulário de verdade do módulo. Aqui eles viram marcas
// reconhecíveis: o que se testa é QUAL formulário abriu, não o que ele faz.
vi.mock("./acoes/AcaoRapidaVenda", () => ({
  AcaoRapidaVenda: ({ onFechar }: { onFechar: () => void }) => (
    <div data-testid="form-venda">
      <button onClick={onFechar}>fechar venda</button>
    </div>
  ),
}));
vi.mock("./acoes/AcaoRapidaCliente", () => ({
  AcaoRapidaCliente: () => <div data-testid="form-cliente" />,
}));
vi.mock("./acoes/AcaoRapidaProduto", () => ({
  AcaoRapidaProduto: () => <div data-testid="form-produto" />,
}));
vi.mock("./acoes/AcaoRapidaProjeto", () => ({
  AcaoRapidaProjeto: () => <div data-testid="form-projeto" />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

/** Módulos desligados nesta renderização. */
let desligados: ModuloOpcional[] = [];
vi.mock("@/hooks/useModulos", () => ({
  useModulos: () => ({
    moduloAtivo: (m: ModuloOpcional) => !desligados.includes(m),
  }),
}));

let sidebarOpen = false;
vi.mock("@/store/useAppStore", () => ({
  useAppStore: () => ({ sidebarOpen }),
}));

beforeEach(() => {
  desligados = [];
  sidebarOpen = false;
});

function abrirMenu() {
  render(<BotaoAcaoRapida />);
  fireEvent.click(screen.getByTestId("botao-acao-rapida"));
}

describe("O botão", () => {
  it("aparece fechado, com o menu escondido", () => {
    render(<BotaoAcaoRapida />);

    expect(screen.getByTestId("botao-acao-rapida")).toBeInTheDocument();
    expect(screen.queryByTestId("menu-acao-rapida")).not.toBeInTheDocument();
  });

  it("abre e fecha o menu no clique", () => {
    abrirMenu();
    expect(screen.getByTestId("menu-acao-rapida")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("botao-acao-rapida"));

    expect(screen.queryByTestId("menu-acao-rapida")).not.toBeInTheDocument();
  });
});

describe("GUARDA: módulo desligado não aparece", () => {
  it("com tudo ligado, oferece as quatro ações", () => {
    abrirMenu();
    expect(screen.getAllByRole("menuitem")).toHaveLength(4);
  });

  it("sem Estoque, some venda e produto — as duas dependem dele", () => {
    desligados = ["estoque"];
    abrirMenu();

    const rotulos = screen.getAllByRole("menuitem").map((b) => b.textContent);
    expect(rotulos).toEqual(["Registrar cliente", "Registrar projeto"]);
  });

  it("sem Projetos, some registrar projeto", () => {
    desligados = ["projetos"];
    abrirMenu();

    expect(
      screen.queryByRole("menuitem", { name: /registrar projeto/i })
    ).not.toBeInTheDocument();
  });

  it("com tudo desligado, sobra só o cliente — que é obrigatório", () => {
    desligados = ["estoque", "projetos", "agenda", "equipe", "documentos", "fornecedores"];
    abrirMenu();

    const rotulos = screen.getAllByRole("menuitem").map((b) => b.textContent);
    expect(rotulos).toEqual(["Registrar cliente"]);
  });

  it("a venda segue o mesmo módulo que a sidebar usa para a aba Vendas", () => {
    // Se alguém mudar a sidebar e esquecer daqui (ou o contrário), o menu
    // ofereceria registrar venda numa empresa que nem vê a aba.
    const venda = ACOES.find((a) => a.acao === "venda");
    expect(venda?.modulo).toBe("estoque");
  });
});

describe("Escolher uma ação abre o formulário do módulo", () => {
  it.each([
    [/registrar venda/i, "form-venda"],
    [/registrar cliente/i, "form-cliente"],
    [/registrar produto/i, "form-produto"],
    [/registrar projeto/i, "form-projeto"],
  ])("%s → %s", (rotulo, testid) => {
    abrirMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: rotulo }));

    expect(screen.getByTestId(testid)).toBeInTheDocument();
    // O menu sai de cena: quem escolheu já está no formulário.
    expect(screen.queryByTestId("menu-acao-rapida")).not.toBeInTheDocument();
  });

  it("fechar o formulário devolve a pessoa à tela, sem navegar", () => {
    abrirMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /registrar venda/i }));

    fireEvent.click(screen.getByText("fechar venda"));

    expect(screen.queryByTestId("form-venda")).not.toBeInTheDocument();
    // E o botão continua ali, pronto para a próxima.
    expect(screen.getByTestId("botao-acao-rapida")).toBeInTheDocument();
  });
});

describe("Teclado e leitor de tela", () => {
  it("o botão se anuncia e diz que abre um menu", () => {
    render(<BotaoAcaoRapida />);
    const botao = screen.getByTestId("botao-acao-rapida");

    expect(botao).toHaveAttribute("aria-label", "Ações rápidas");
    expect(botao).toHaveAttribute("aria-haspopup", "menu");
    expect(botao).toHaveAttribute("aria-expanded", "false");
  });

  it("aberto, o botão diz que fecha e aponta para o menu", () => {
    abrirMenu();
    const botao = screen.getByTestId("botao-acao-rapida");

    expect(botao).toHaveAttribute("aria-expanded", "true");
    expect(botao).toHaveAttribute("aria-controls", "menu-acao-rapida");
    expect(botao).toHaveAttribute("aria-label", "Fechar ações rápidas");
  });

  it("Esc fecha o menu e devolve o foco ao botão", async () => {
    abrirMenu();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByTestId("menu-acao-rapida")).not.toBeInTheDocument()
    );
    // Sem isto, quem navega por teclado perderia o ponto onde estava.
    expect(screen.getByTestId("botao-acao-rapida")).toHaveFocus();
  });

  it("clicar fora fecha o menu", async () => {
    abrirMenu();

    fireEvent.mouseDown(document.body);

    await waitFor(() =>
      expect(screen.queryByTestId("menu-acao-rapida")).not.toBeInTheDocument()
    );
  });
});

describe("Onde o botão fica", () => {
  /** O container fixo que carrega o botão. */
  const caixa = () => screen.getByTestId("botao-acao-rapida").parentElement!;

  it("fica no canto inferior direito, abaixo do header e dos modais", () => {
    render(<BotaoAcaoRapida />);
    const classes = caixa().className;

    expect(classes).toContain("fixed");
    expect(classes).toContain("bottom-5");
    expect(classes).toContain("right-5");
    // Header é z-30, sidebar z-40, modais z-50: o botão passa por baixo dos três.
    expect(classes).toContain("z-20");
  });

  it("no mobile some enquanto a gaveta do menu está aberta", () => {
    // A gaveta cobre a tela com um fundo escuro; o botão flutuaria sobre ela.
    sidebarOpen = true;
    render(<BotaoAcaoRapida />);

    expect(caixa().className).toContain("hidden md:flex");
  });

  it("no desktop a sidebar expandida não esconde o botão", () => {
    // `sidebarOpen` no desktop quer dizer "expandida", não "por cima da tela" —
    // e é a mesma flag. O `md:flex` é o que separa os dois casos.
    sidebarOpen = true;
    render(<BotaoAcaoRapida />);

    expect(caixa().className).toContain("md:flex");
  });

  it("usa a cor de marca, que segue a paleta da empresa", () => {
    render(<BotaoAcaoRapida />);
    expect(screen.getByTestId("botao-acao-rapida").className).toContain("bg-brand-600");
  });

  it("a animação do menu respeita quem pediu menos movimento", () => {
    abrirMenu();
    const item = screen.getAllByRole("menuitem")[0];

    expect(item.className).toContain("motion-safe:animate-surgir-de-baixo");
    expect(item.className).toContain("motion-reduce:animate-none");
  });
});

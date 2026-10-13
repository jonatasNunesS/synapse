/**
 * No celular, a tela não começa coberta pelo menu.
 *
 * ERR-09 / INC-02 — o bug mais antigo do sistema. Apareceu no QUALITY_AUDIT e
 * sobreviveu a todas as levas desde então: todo carregamento no celular
 * começava com a gaveta por cima do conteúdo e um fundo escuro em cima de
 * tudo, e a primeira coisa que a pessoa fazia era fechar o menu que ela não
 * abriu.
 *
 * A causa era de modelagem, não de CSS: `sidebarOpen: true` servia dois
 * significados que discordam justamente no valor inicial —
 *
 *     desktop: "expandida"            → começa ligada, e está certo
 *     mobile:  "gaveta sobre a tela"  → nunca pode começar ligada
 *
 * Agora são dois campos. E o estado inicial da gaveta é decidido pelo CSS
 * (`-translate-x-full` na base, `md:translate-x-0` no desktop), não por
 * JavaScript: inicializar por breakpoint em JS não resolveria, porque no
 * servidor não existe viewport — o primeiro paint do celular sairia com a
 * gaveta aberta e só depois o hook a fecharia. Trocaria o bug por um flash.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...resto }: React.ComponentProps<"a">) => (
    <a href={href as string} {...resto}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    usuario: { nome: "Jonatas Nunes" },
    empresa: { plano: "starter" },
    logout: vi.fn(),
  }),
}));

/**
 * O breakpoint, controlável pelo teste.
 *
 * Mockado porque o jsdom não tem `matchMedia` de verdade: o hook real cairia
 * no ramo "sem matchMedia" e responderia sempre `false`, e aí o teste do
 * celular estaria medindo o desktop sem avisar.
 */
let estreita = false;
vi.mock("@/hooks/useTelaEstreita", () => ({
  useTelaEstreita: () => estreita,
}));

import { Sidebar } from "./Sidebar";
import { useAppStore } from "@/store/useAppStore";

/**
 * O valor com que a gaveta NASCE, lido no import — antes de qualquer
 * `beforeEach` mexer no store.
 *
 * A primeira versão deste teste lia `getState().gavetaAberta` dentro do caso,
 * depois de o `beforeEach` já ter escrito `false` ali. Dizia o que ela mesma
 * havia acabado de escrever: trocar o default no store de volta para `true`
 * não quebrava nada. É o defeito original, e passava.
 */
const GAVETA_AO_NASCER = useAppStore.getState().gavetaAberta;
const EXPANDIDA_AO_NASCER = useAppStore.getState().sidebarExpandida;

function aside(): HTMLElement {
  const el = document.querySelector("aside");
  if (!el) throw new Error("a sidebar não renderizou");
  return el as HTMLElement;
}

/** O fundo escuro que cobre o conteúdo quando a gaveta está aberta. */
function overlay(): Element | null {
  return document.querySelector("[aria-hidden='true'].fixed.inset-0");
}

/**
 * Uma classe exata está na lista?
 *
 * Por token, e não por substring: `toContain("translate-x-0")` casa dentro de
 * `md:translate-x-0`, que está sempre presente. A primeira versão deste teste
 * passou por isso e não media nada.
 */
function temClasse(classe: string): boolean {
  return aside().className.split(/\s+/).includes(classe);
}

/** Muda o store com o React sabendo, para o componente repintar. */
type EstadoParcial = Partial<ReturnType<typeof useAppStore.getState>>;

function definir(estado: EstadoParcial) {
  act(() => useAppStore.setState(estado));
}

beforeEach(() => {
  estreita = false;
  // O mesmo estado que o app tem ao carregar.
  useAppStore.setState({ sidebarExpandida: true, gavetaAberta: false });
});

describe("Carregamento no celular", () => {
  beforeEach(() => {
    estreita = true;
  });

  it("a gaveta começa FECHADA", () => {
    render(<Sidebar />);

    // `-translate-x-full` tira a coluna da tela. É a classe que diz, no
    // primeiro paint, que o conteúdo está visível.
    expect(temClasse("-translate-x-full")).toBe(true);
    // E o `translate-x-0` sem prefixo — o que a traria para a tela no
    // celular — NÃO está. O `md:translate-x-0` está, e é outra classe.
    expect(temClasse("translate-x-0")).toBe(false);
    expect(temClasse("md:translate-x-0")).toBe(true);
  });

  it("nada cobre o conteúdo na carga", () => {
    render(<Sidebar />);

    // O fundo escuro é o que tornava o bug impossível de ignorar: não dava
    // para tocar em nada atrás dele.
    expect(overlay()).toBeNull();
  });

  it("o default do store nasce com a gaveta FECHADA", () => {
    // A garantia na origem, e o caso que define a correção: era este `true`
    // compartilhado com o desktop que cobria a tela a cada carregamento.
    expect(GAVETA_AO_NASCER).toBe(false);
  });

  it("e a sidebar do desktop nasce expandida — os defaults discordam", () => {
    // Os dois valores juntos são o motivo de existirem dois campos: uma flag
    // só não pode nascer `true` e `false` ao mesmo tempo.
    expect(EXPANDIDA_AO_NASCER).toBe(true);
    expect(GAVETA_AO_NASCER).not.toBe(EXPANDIDA_AO_NASCER);
  });

  it("abrir e fechar continua funcionando", async () => {
    render(<Sidebar />);

    definir({ gavetaAberta: true });
    expect(temClasse("translate-x-0")).toBe(true);
    expect(overlay()).not.toBeNull();

    // No celular o botão do topo FECHA a gaveta — não recolhe a coluna.
    await userEvent.click(screen.getByRole("button", { name: "Fechar menu" }));
    expect(useAppStore.getState().gavetaAberta).toBe(false);
    expect(temClasse("-translate-x-full")).toBe(true);
  });

  it("fechar pelo fundo escuro também", async () => {
    render(<Sidebar />);
    definir({ gavetaAberta: true });

    await userEvent.click(overlay() as Element);
    expect(useAppStore.getState().gavetaAberta).toBe(false);
  });

  it("navegar fecha a gaveta", async () => {
    render(<Sidebar />);
    definir({ gavetaAberta: true });

    await userEvent.click(screen.getByText("Clientes"));
    expect(useAppStore.getState().gavetaAberta).toBe(false);
  });

  it("a gaveta aberta mostra os rótulos, mesmo com o desktop recolhido", () => {
    // `sidebarExpandida` é estado do desktop e não tem voz aqui: a gaveta do
    // celular tem 256px e sempre cabe o texto.
    useAppStore.setState({ sidebarExpandida: false, gavetaAberta: true });
    render(<Sidebar />);

    expect(screen.getByText("Clientes")).toBeInTheDocument();
    expect(temClasse("w-[256px]")).toBe(true);
  });
});

describe("Carregamento no desktop", () => {
  it("a sidebar começa expandida, como sempre foi", () => {
    render(<Sidebar />);

    expect(temClasse("md:w-[256px]")).toBe(true);
    // `md:translate-x-0` é o que traz a coluna de volta sem JavaScript.
    expect(temClasse("md:translate-x-0")).toBe(true);
    expect(screen.getByText("Clientes")).toBeInTheDocument();
  });

  it("recolher deixa só os ícones, e não some com a coluna", async () => {
    render(<Sidebar />);

    await userEvent.click(screen.getByRole("button", { name: "Recolher menu" }));

    expect(useAppStore.getState().sidebarExpandida).toBe(false);
    expect(temClasse("md:w-[64px]")).toBe(true);
    expect(temClasse("md:translate-x-0")).toBe(true);
    expect(screen.queryByText("Clientes")).not.toBeInTheDocument();
  });

  it.each([true, false])(
    "recolher no desktop NÃO mexe na gaveta (gaveta=%s)",
    (gaveta) => {
      // Os dois valores de partida, de propósito: com a gaveta já fechada,
      // uma implementação que escreve `gavetaAberta: !sidebarExpandida`
      // acerta por coincidência. Só o caso `true` mostra o arrasto.
      definir({ sidebarExpandida: true, gavetaAberta: gaveta });

      act(() => useAppStore.getState().alternarExpansao());

      expect(useAppStore.getState().sidebarExpandida).toBe(false);
      expect(useAppStore.getState().gavetaAberta).toBe(gaveta);
    }
  );

  it.each([true, false])(
    "e fechar a gaveta não recolhe a coluna (expandida=%s)",
    (expandida) => {
      definir({ sidebarExpandida: expandida, gavetaAberta: true });

      act(() => useAppStore.getState().setGavetaAberta(false));

      expect(useAppStore.getState().sidebarExpandida).toBe(expandida);
    }
  );

  it("não há fundo escuro no desktop", () => {
    render(<Sidebar />);
    expect(overlay()).toBeNull();
  });
});

describe("Hidratação", () => {
  it("o primeiro render (antes de saber o breakpoint) já esconde a gaveta", () => {
    // `useTelaEstreita` responde `false` no servidor e no primeiro render.
    // Se o estado inicial da gaveta dependesse dele, o celular pintaria o
    // menu aberto e só depois o fecharia.
    estreita = false;
    render(<Sidebar />);

    expect(temClasse("-translate-x-full")).toBe(true);
    expect(temClasse("md:translate-x-0")).toBe(true);
  });

  it("o mesmo markup serve para as duas telas", () => {
    // Nenhuma das duas classes de posição depende de JS: as duas saem no
    // mesmo `className`, e o navegador escolhe qual vale pelo `md:`. É o que
    // garante que servidor e cliente rendam igual.
    estreita = false;
    const { unmount } = render(<Sidebar />);
    const noServidor = aside().className;
    unmount();

    estreita = true;
    render(<Sidebar />);
    expect(aside().className).toBe(noServidor);
  });
});

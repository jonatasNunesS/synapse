/**
 * Telas públicas de autenticação no tema claro.
 *
 * O cadastro e a redefinição de senha fixavam a cor do texto do input em
 * branco. No tema escuro passava despercebido; no claro o texto digitado
 * ficava branco sobre fundo claro — invisível, e a pessoa preenchia às
 * cegas (QUEBRA-02 do QUALITY_AUDIT.md).
 *
 * A cor tem de vir do token, que é o que troca junto com o tema. Os testes
 * cobrem as quatro telas: as duas que quebraram e as duas que já estavam
 * certas, para nenhuma regredir.
 */
import { readFileSync } from "fs";
import { join } from "path";

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import RegistroPage from "./registro/page";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ registro: vi.fn().mockResolvedValue(undefined) }),
}));

const TELAS = ["login", "registro", "recuperar-senha", "redefinir-senha"] as const;

function fonteDa(tela: string): string {
  return readFileSync(join(__dirname, tela, "page.tsx"), "utf8");
}

/** As linhas que montam a classe do input — é onde a cor do texto é definida. */
function linhasDeInput(fonte: string): string[] {
  return fonte
    .split("\n")
    .filter((l) => l.includes("rounded-lg bg-card/60 border"));
}

describe("Tema claro nas telas de autenticação", () => {
  it.each(TELAS)("o input de %s tira a cor do texto do token", (tela) => {
    const linhas = linhasDeInput(fonteDa(tela));
    expect(linhas.length).toBeGreaterThan(0);

    for (const linha of linhas) {
      expect(linha).toContain("text-foreground");
      // Cor fixa não acompanha a troca de tema — é o que causou o bug.
      expect(linha).not.toContain("text-white");
    }
  });

  it.each(TELAS)("o placeholder de %s também vem do token", (tela) => {
    for (const linha of linhasDeInput(fonteDa(tela))) {
      expect(linha).toContain("placeholder:text-muted-foreground");
      expect(linha).not.toContain("placeholder-slate-500");
    }
  });

  it("mantém o branco onde ele é legítimo (sobre a cor da marca)", () => {
    // Ícone do logo e texto de botão ficam sobre fundo de marca: brancos
    // de propósito, nos dois temas. A correção não pode ter levado junto.
    for (const tela of TELAS) {
      expect(fonteDa(tela)).toContain("text-white");
    }
  });

  it("renderiza o cadastro com a cor do texto vinda do token", () => {
    render(<RegistroPage />);
    const nome = screen.getByPlaceholderText("João Silva");

    expect(nome.className).toContain("text-foreground");
    expect(nome.className).not.toContain("text-white");
  });
});

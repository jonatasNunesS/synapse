/**
 * Versão do sistema — o rótulo que o fundador confere no rodapé para saber
 * se o build no ar é o atual. Cobre a montagem do label e garante que o
 * package.json (fonte única de verdade) está em 0.2.0.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildVersionLabel } from "./version";

describe("buildVersionLabel", () => {
  it("mostra só a versão quando não há SHA de build", () => {
    expect(buildVersionLabel("0.2.0")).toBe("v0.2.0");
  });

  it('trata "dev" como ausência de SHA (build local)', () => {
    expect(buildVersionLabel("0.2.0", "dev")).toBe("v0.2.0");
  });

  it("inclui o hash curto do commit quando presente", () => {
    expect(buildVersionLabel("0.2.0", "a1b2c3d")).toBe("v0.2.0 · a1b2c3d");
  });
});

describe("package.json (fonte única de verdade da versão)", () => {
  it('está na versão "0.2.0"', () => {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "package.json"), "utf8")
    );
    expect(pkg.version).toBe("0.2.0");
  });
});

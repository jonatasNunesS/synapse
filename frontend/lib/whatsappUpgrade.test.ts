/**
 * URL de upgrade via WhatsApp: mensagem pré-preenchida correta quando há
 * número configurado; null (nenhum botão) quando não há.
 */
import { describe, it, expect } from "vitest";
import { buildUpgradeWhatsappUrl } from "./whatsappUpgrade";

describe("buildUpgradeWhatsappUrl", () => {
  it("monta wa.me com a mensagem incluindo nome, empresa e plano", () => {
    const url = buildUpgradeWhatsappUrl({
      numero: "5511999999999",
      nome: "Maria",
      empresa: "Padaria da Maria",
      plano: "Starter",
    });
    expect(url).not.toBeNull();
    expect(url!).toContain("https://wa.me/5511999999999?text=");

    const texto = decodeURIComponent(url!.split("text=")[1]);
    expect(texto).toBe(
      "Olá! Sou Maria da empresa Padaria da Maria (plano Starter) e " +
        "gostaria de fazer upgrade do meu plano Synapse."
    );
  });

  it("retorna null quando o número não está definido (degradação graciosa)", () => {
    expect(buildUpgradeWhatsappUrl({ numero: undefined, nome: "X" })).toBeNull();
    expect(buildUpgradeWhatsappUrl({ numero: "", nome: "X" })).toBeNull();
    expect(buildUpgradeWhatsappUrl({ numero: null, nome: "X" })).toBeNull();
  });

  it("limpa caracteres não numéricos do número", () => {
    const url = buildUpgradeWhatsappUrl({ numero: "+55 (11) 99999-9999" });
    expect(url!).toContain("wa.me/5511999999999?text=");
  });

  it("usa fallbacks amigáveis quando faltam dados do usuário/empresa", () => {
    const url = buildUpgradeWhatsappUrl({ numero: "5511999999999" });
    const texto = decodeURIComponent(url!.split("text=")[1]);
    expect(texto).toContain("Sou cliente da empresa minha empresa");
    expect(texto).toContain("plano atual");
  });
});

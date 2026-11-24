import { describe, expect, it } from "vitest";
import { SUPPORT_EMAIL_ERROR, normalizeSupportEmail } from "./support-email";

describe("support-email", () => {
  it("normaliza: trim e minúsculas", () => {
    expect(normalizeSupportEmail("  Contato@FreelaServicos.com.br ")).toBe("contato@freelaservicos.com.br");
  });

  it("recusa e-mail inválido ou vazio", () => {
    expect(normalizeSupportEmail("")).toBeNull();
    expect(normalizeSupportEmail("sem-arroba")).toBeNull();
    expect(normalizeSupportEmail("a@b")).toBeNull();
    expect(normalizeSupportEmail("a b@c.com")).toBeNull();
  });

  it("recusa mais de 254 caracteres", () => {
    expect(normalizeSupportEmail(`${"a".repeat(250)}@x.com`)).toBeNull();
  });

  it("mensagem igual à da API", () => {
    expect(SUPPORT_EMAIL_ERROR).toBe("Informe um e-mail válido, ex.: contato@freelaservicos.com.br.");
  });
});

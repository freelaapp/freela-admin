import { describe, expect, it } from "vitest";
import { adminLoginNoticeFromSearch } from "./login-notice";

describe("adminLoginNoticeFromSearch", () => {
  it("motivo=senha-trocada pede para entrar com a nova senha", () => {
    expect(adminLoginNoticeFromSearch("?motivo=senha-trocada")).toBe("Senha trocada. Entre com a nova senha.");
  });

  it("sem motivo ou motivo desconhecido: nada", () => {
    expect(adminLoginNoticeFromSearch("")).toBeNull();
    expect(adminLoginNoticeFromSearch("?motivo=outro")).toBeNull();
  });
});

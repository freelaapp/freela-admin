import { describe, expect, it } from "vitest";
import { loginNoticeFromSearch } from "./login-notice";

describe("loginNoticeFromSearch", () => {
  it("motivo=desativado mostra o aviso", () => {
    expect(loginNoticeFromSearch("?motivo=desativado")).toBe("Seu acesso de consultor foi desativado.");
  });

  it("sem motivo ou motivo desconhecido: nada", () => {
    expect(loginNoticeFromSearch("")).toBeNull();
    expect(loginNoticeFromSearch("?motivo=outro")).toBeNull();
  });
});

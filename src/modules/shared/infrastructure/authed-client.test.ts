import { describe, expect, it } from "vitest";
import { buildLoginRedirect } from "./authed-client";

const reasons = { CONSULTANT_INACTIVE: "desativado" };

describe("buildLoginRedirect", () => {
  it("código conhecido vira ?motivo=", () => {
    expect(
      buildLoginRedirect(
        "/consultor/login",
        { error: { code: "CONSULTANT_INACTIVE", message: "Seu acesso de consultor foi desativado." } },
        reasons,
      ),
    ).toBe("/consultor/login?motivo=desativado");
  });

  it("401 comum (token vencido) volta só para o login", () => {
    expect(buildLoginRedirect("/consultor/login", { error: { code: "UNAUTHORIZED" } }, reasons)).toBe(
      "/consultor/login",
    );
  });

  it("sem corpo ou sem mapa: login puro (staff não muda)", () => {
    expect(buildLoginRedirect("/login", undefined)).toBe("/login");
    expect(buildLoginRedirect("/login", { error: { code: "CONSULTANT_INACTIVE" } })).toBe("/login");
  });

  it("não cai em propriedade herdada do objeto", () => {
    expect(buildLoginRedirect("/login", { error: { code: "toString" } }, reasons)).toBe("/login");
  });
});

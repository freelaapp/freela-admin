import { describe, expect, it } from "vitest";
import { PLAN_LABEL, assignablePlanOptions } from "./assignable-plans";

describe("assignablePlanOptions — planos que o admin pode atribuir", () => {
  it("Básico inativo não aparece para atribuir", () => {
    // O /v1/plans devolve só os ativos: depois de 22/10/2026, sem o Básico.
    const options = assignablePlanOptions(["FREE", "VIP", "ENTERPRISE"]);

    expect(options).toEqual([
      { value: "FREE", label: "Grátis" },
      { value: "VIP", label: "Vip" },
      { value: "ENTERPRISE", label: "Grandes Redes" },
    ]);
  });

  it("sem a lista da API (carregando ou erro): todos, como antes; a API recusa plano inativo", () => {
    expect(assignablePlanOptions(undefined).map((option) => option.value)).toEqual([
      "FREE",
      "BASIC",
      "VIP",
      "ENTERPRISE",
    ]);
  });

  it("segue a ordem do catálogo, não a da resposta", () => {
    expect(assignablePlanOptions(["ENTERPRISE", "FREE"]).map((option) => option.value)).toEqual([
      "FREE",
      "ENTERPRISE",
    ]);
  });

  it("o rótulo do Básico continua existindo para o histórico", () => {
    expect(PLAN_LABEL.BASIC).toBe("Básico");
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_HISTORY_FORM, buildHistoryCriteria } from "./history-form";

describe("buildHistoryCriteria", () => {
  it("padrão: 1 serviço e nota 4,0", () => {
    expect(buildHistoryCriteria(DEFAULT_HISTORY_FORM)).toEqual({
      ok: true,
      payload: { minCompletedServices: 1, minRating: 4 },
    });
  });

  it("aceita vírgula e ponto na nota", () => {
    expect(buildHistoryCriteria({ minServices: "3", minRating: "4,5" })).toEqual({
      ok: true,
      payload: { minCompletedServices: 3, minRating: 4.5 },
    });
    expect(buildHistoryCriteria({ minServices: "3", minRating: "0.5" })).toMatchObject({ ok: true });
  });

  it("aceita nota 0 e 5", () => {
    expect(buildHistoryCriteria({ minServices: "1", minRating: "0" })).toMatchObject({ ok: true });
    expect(buildHistoryCriteria({ minServices: "1", minRating: "5" })).toMatchObject({ ok: true });
  });

  it.each(["", "0", "1001", "1,5", "abc", "-1"])("serviços inválidos (%s)", (v) => {
    expect(buildHistoryCriteria({ minServices: v, minRating: "4" })).toEqual({
      ok: false,
      error: "Serviços concluídos: um número inteiro de 1 a 1.000.",
    });
  });

  it.each(["", "5,1", "-1", "4,55", "x"])("nota inválida (%s)", (v) => {
    expect(buildHistoryCriteria({ minServices: "1", minRating: v })).toEqual({
      ok: false,
      error: "Nota: de 0 a 5, com no máximo uma casa (ex.: 4,0).",
    });
  });
});

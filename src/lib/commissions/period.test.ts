import { describe, expect, it } from "vitest";
import { brasiliaToday, resolveCommissionPeriod } from "./period";

const NOW = new Date("2026-10-15T02:00:00Z"); // 14/10 23:00 em Brasília

describe("resolveCommissionPeriod", () => {
  it("hoje, mês e ano no calendário de Brasília", () => {
    expect(brasiliaToday(NOW)).toBe("2026-10-14");
    expect(resolveCommissionPeriod({ preset: "today", customFrom: "", customTo: "" }, NOW)).toEqual({
      from: "2026-10-14",
      to: "2026-10-14",
    });
    expect(resolveCommissionPeriod({ preset: "this_month", customFrom: "", customTo: "" }, NOW)).toEqual({
      from: "2026-10-01",
      to: "2026-10-14",
    });
    expect(resolveCommissionPeriod({ preset: "this_year", customFrom: "", customTo: "" }, NOW)).toEqual({
      from: "2026-01-01",
      to: "2026-10-14",
    });
  });

  it("personalizado: lado vazio = sem limite; invertido é corrigido", () => {
    expect(
      resolveCommissionPeriod({ preset: "custom", customFrom: "2026-10-10", customTo: "" }, NOW),
    ).toEqual({ from: "2026-10-10", to: undefined });
    expect(
      resolveCommissionPeriod({ preset: "custom", customFrom: "2026-10-10", customTo: "2026-10-01" }, NOW),
    ).toEqual({ from: "2026-10-01", to: "2026-10-10" });
  });
});

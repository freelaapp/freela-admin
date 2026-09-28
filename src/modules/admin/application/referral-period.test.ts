import { describe, expect, it } from "vitest";
import {
  brasiliaToday,
  describeReferralRange,
  resolveReferralPeriod,
  shiftDay,
  toInstantRange,
  type ReferralPeriodSelection,
} from "./referral-period";

// 28/09/2026 01:00 UTC = 27/09 22:00 em Brasília: "hoje" ainda é 27/09.
const NOW = new Date("2026-09-28T01:00:00.000Z");

const pick = (preset: ReferralPeriodSelection["preset"], customFrom = "", customTo = "") =>
  resolveReferralPeriod({ preset, customFrom, customTo }, NOW);

describe("referral-period", () => {
  it("usa o dia de Brasília, não o de UTC", () => {
    expect(brasiliaToday(NOW)).toBe("2026-09-27");
  });

  it("atravessa virada de mês sem passar por fuso", () => {
    expect(shiftDay("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("7 e 30 dias incluem hoje", () => {
    expect(pick("7d")).toEqual({ from: "2026-09-21", to: "2026-09-27" });
    expect(pick("30d")).toEqual({ from: "2026-08-29", to: "2026-09-27" });
  });

  it("este mês e mês passado", () => {
    expect(pick("this_month")).toEqual({ from: "2026-09-01", to: "2026-09-27" });
    expect(pick("last_month")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("tudo = sem datas", () => {
    expect(pick("all")).toEqual({});
  });

  it("personalizado invertido é desinvertido", () => {
    expect(pick("custom", "2026-09-20", "2026-09-01")).toEqual({
      from: "2026-09-01",
      to: "2026-09-20",
    });
    expect(pick("custom", "", "2026-09-20")).toEqual({ from: undefined, to: "2026-09-20" });
  });

  it("vira instantes com o fuso de Brasília para a lista", () => {
    expect(toInstantRange({ from: "2026-09-01", to: "2026-09-28" })).toEqual({
      from: "2026-09-01T00:00:00.000-03:00",
      to: "2026-09-28T23:59:59.999-03:00",
    });
    // O fim cobre o dia inteiro de Brasília.
    expect(new Date("2026-09-28T23:59:59.999-03:00").toISOString()).toBe(
      "2026-09-29T02:59:59.999Z",
    );
    expect(toInstantRange({})).toEqual({});
  });

  it("descreve o período em português", () => {
    expect(describeReferralRange({ from: "2026-09-01", to: "2026-09-28" })).toBe(
      "01/09/2026 a 28/09/2026",
    );
    expect(describeReferralRange({ from: "2026-09-28", to: "2026-09-28" })).toBe("28/09/2026");
    expect(describeReferralRange({})).toBe("todo o período");
  });
});

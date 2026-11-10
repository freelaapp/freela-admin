import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import type { AdminLot } from "@/modules/admin/infrastructure/lots-api";
import {
  attentionReasons,
  companySeesText,
  filterLots,
  formatServiceDate,
  isLotNotFound,
  isLotsUnavailable,
  lotCountsLine,
  lotLineText,
  startsInText,
} from "./lots-presentation";

const lot = (over: Partial<AdminLot> = {}): AdminLot => ({
  id: "l1",
  serviceDate: "2026-11-14",
  trigger: "EQUAL_GROUP",
  createdAt: null,
  past: false,
  nextStep: "CHOOSE",
  promiseCorrectedAt: null,
  totals: { vacancies: 18, functions: 3, chosen: 7, paid: 0, free: 11, candidatesToChoose: 13, chosenUnpaid: 7, cancelled: 0 },
  groups: [],
  inSelection: [],
  contractorId: "c1",
  companyName: "Buffet Villa",
  firstStartTime: null,
  attention: [],
  ...over,
});

function httpError(status: number, code?: string) {
  const err = new AxiosError("x");
  err.response = { status, data: code ? { error: { code, message: "m" } } : {} } as never;
  return err;
}

describe("lots-presentation", () => {
  it("formata o dia sem mudar de data (sem fuso)", () => {
    expect(formatServiceDate("2026-11-14")).toBe("sáb 14/11");
    expect(formatServiceDate("2026-11-15")).toBe("dom 15/11");
    expect(formatServiceDate("2026-11-14T00:00:00.000Z")).toBe("sáb 14/11");
    expect(formatServiceDate("")).toBe("—");
  });

  it("contagens, só números", () => {
    expect(lotCountsLine(lot())).toBe("18 vagas · 7 escolhidas · 0 pagas · 11 livres");
    expect(lotLineText(lot({ totals: { ...lot().totals, vacancies: 1, chosen: 1, paid: 1 } }))).toBe(
      "Lote: 1 vaga · 1 escolhida · 1 paga",
    );
    expect(lotCountsLine(lot())).not.toMatch(/R\$/);
  });

  it("motivos de atenção em português; código desconhecido é ignorado", () => {
    const reasons = attentionReasons(lot({ attention: ["FREE_SOON", "UNPAID_SOON", "NO_CANDIDATES", "NOVO"] }));
    expect(reasons).toEqual([
      "Faltam 11 escolhas e começa em menos de 6 h",
      "7 escolhidos sem pagar e começa em menos de 3 h",
      "Ninguém se candidatou a alguma função",
    ]);
    expect(attentionReasons(lot())).toEqual([]);
  });

  it("começa em", () => {
    const now = new Date("2026-11-14T15:00:00.000Z");
    expect(startsInText("2026-11-14T18:00:00.000Z", now)).toBe("começa em 3 h");
    expect(startsInText("2026-11-14T15:40:00.000Z", now)).toBe("começa em 40 min");
    expect(startsInText("2026-11-14T14:00:00.000Z", now)).toBe("já começou");
    expect(startsInText(null, now)).toBeNull();
  });

  it("A empresa vê, sem reais", () => {
    expect(companySeesText(lot())).toBe("Faltam 11 escolhas; 13 candidatos esperam.");
    expect(companySeesText(lot({ nextStep: "PAY" }))).toMatch(/^Falta pagar 7 escolhidos\./);
    expect(companySeesText(lot({ nextStep: null }))).toBeNull();
    expect(companySeesText(lot({ nextStep: "X" }))).toBeNull();
  });

  it("filtros Hoje, Amanhã e Atenção (dia de Brasília)", () => {
    // 15/11 01:00 UTC ainda é 14/11 22h em Brasília
    const now = new Date("2026-11-15T01:00:00.000Z");
    const a = lot({ id: "a", serviceDate: "2026-11-14", attention: ["FREE_SOON"] });
    const b = lot({ id: "b", serviceDate: "2026-11-15" });
    expect(filterLots([a, b], "today", now).map((l) => l.id)).toEqual(["a"]);
    expect(filterLots([a, b], "tomorrow", now).map((l) => l.id)).toEqual(["b"]);
    expect(filterLots([a, b], "attention", now).map((l) => l.id)).toEqual(["a"]);
    expect(filterLots([a, b], "all", now)).toHaveLength(2);
  });

  it("404 = indisponível, com ou sem código; 500 não", () => {
    expect(isLotsUnavailable(httpError(404))).toBe(true);
    expect(isLotsUnavailable(httpError(404, "VACANCY_LOTS_DISABLED"))).toBe(true);
    expect(isLotsUnavailable(httpError(500))).toBe(false);
    expect(isLotNotFound(httpError(404, "LOT_NOT_FOUND"))).toBe(true);
    expect(isLotNotFound(httpError(404))).toBe(false);
  });
});

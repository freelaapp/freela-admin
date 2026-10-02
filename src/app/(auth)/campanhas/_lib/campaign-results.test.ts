import { describe, expect, it } from "vitest";
import {
  barWidth,
  excludedLines,
  formatCost,
  formatPercent,
  funnelSteps,
  lastDaysLabel,
  lastRunSummary,
  occurrenceLabel,
} from "./campaign-results";

const results = {
  sent: 190,
  delivered: 180,
  read: 120,
  clicked: 30,
  clickTracking: true,
  rates: { deliveredRate: 0.9474, readRate: 0.6667, clickRate: 0.1667 },
};

describe("números dos resultados (spec 2026-10-01 parte 2 §6/§8)", () => {
  it("porcentagem inteira; zero, NaN e negativo viram 0%", () => {
    expect(formatPercent(0.9474)).toBe("95%");
    expect(formatPercent(0.1667)).toBe("17%");
    expect(formatPercent(1.05)).toBe("100%");
    expect(formatPercent(7)).toBe("100%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(Number.NaN)).toBe("0%");
    expect(formatPercent(undefined)).toBe("0%");
  });

  it("custo com centavos", () => {
    expect(formatCost(63)).toBe("R$ 63,00");
    expect(formatCost(2.45)).toBe("R$ 2,45");
    expect(formatCost(undefined)).toBe("R$ 0,00");
  });

  it("funil: enviados → entregues → lidos → clicaram, com a base de cada %", () => {
    expect(funnelSteps(results)).toEqual([
      {
        key: "sent",
        label: "Enviados",
        value: 190,
        percent: null,
        hint: "saíram pela Meta",
      },
      {
        key: "delivered",
        label: "Entregues",
        value: 180,
        percent: "95%",
        hint: "dos enviados",
      },
      {
        key: "read",
        label: "Lidos",
        value: 120,
        percent: "67%",
        hint: "dos entregues",
      },
      {
        key: "clicked",
        label: "Clicaram",
        value: 30,
        percent: "17%",
        hint: "dos entregues",
      },
    ]);
  });

  it('modelo sem "Contar cliques": clicaram fica sem número (não é "0 clicaram")', () => {
    expect(funnelSteps({ ...results, clickTracking: false })[3]).toEqual({
      key: "clicked",
      label: "Clicaram",
      value: null,
      percent: null,
      hint: "Este modelo não conta cliques",
    });
  });

  it("barra do funil em relação aos enviados; sem envio, barra vazia", () => {
    expect(barWidth(180, 190)).toBe(95);
    expect(barWidth(0, 0)).toBe(0);
    expect(barWidth(null, 190)).toBe(0);
    expect(barWidth(300, 190)).toBe(100);
  });

  it("excluídos por motivo com o sinal de menos da spec", () => {
    expect(
      excludedLines(
        { noVacancy: 30, hired: 5, recentlyContacted: 10, optedOut: 12 },
        {
          noVacancyForDays: 30,
          excludeHired: true,
          excludeContactedWithinDays: 7,
        },
      ),
    ).toEqual([
      "−30 por ter publicado vaga nos últimos 30 dias",
      "−5 por já ter contratado",
      "−10 por ter recebido campanha nos últimos 7 dias",
    ]);
    expect(
      excludedLines(
        { noVacancy: 0, hired: 0, recentlyContacted: 0, optedOut: 3 },
        {},
      ),
    ).toEqual([]);
    expect(excludedLines(undefined, undefined)).toEqual([]);
    expect(lastDaysLabel(1)).toBe("no último dia");
  });

  it("execução: data em dd/mm/aaaa e resumo da última", () => {
    expect(occurrenceLabel("2026-10-02")).toBe("02/10/2026");
    expect(occurrenceLabel(null)).toBe("—");
    expect(
      lastRunSummary({
        id: "w-2",
        occurrence: "2026-10-02",
        channel: "WHATSAPP",
        status: "RUNNING",
        startedAt: "2026-10-02T12:00:00.000Z",
        sent: 190,
        delivered: 180,
        read: 120,
        clicked: 30,
      }),
    ).toBe("02/10/2026 · 180 entregues · 120 lidos · 30 cliques");
    expect(
      lastRunSummary({
        id: "p-1",
        occurrence: "2026-10-02",
        channel: "PUSH",
        status: "COMPLETED",
        startedAt: null,
        sent: 150,
        delivered: null,
        read: null,
        clicked: null,
      }),
    ).toBe("02/10/2026 · 150 enviados (push)");
    expect(lastRunSummary(null)).toBe("Ainda não rodou");
  });
});

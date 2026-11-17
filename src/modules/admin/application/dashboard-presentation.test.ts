import { describe, expect, it } from "vitest";
import type { AdminDashboard } from "../infrastructure/dashboard-api";
import {
  DASH,
  buildPeriodGroups,
  buildTotalCards,
  changeText,
  changeTone,
  exclusionText,
  formatCurrencyCents,
  formatDecimal,
  formatInteger,
  formatPercent,
  ratioCaption,
  shortDateTimeBrasilia,
} from "./dashboard-presentation";

const ratio = (numerator: number, denominator: number) => ({
  value: denominator ? numerator / denominator : null,
  numerator,
  denominator,
});

const base: AdminDashboard = {
  generatedAt: "2026-11-17T13:00:00.000Z",
  period: {
    preset: "this_month",
    start: "2026-11-01T03:00:00.000Z",
    end: "2026-11-17T13:00:00.000Z",
    previousStart: "2026-10-01T03:00:00.000Z",
    previousEnd: "2026-10-17T13:00:00.000Z",
    label: "novembro/2026 até agora",
    previousLabel: "01/10 a 17/10",
  },
  exclusions: { excludedAccounts: 2, qaServiceType: "teste" },
  totals: { freelancers: 1200, contractors: 85, platformRevenueCents: 1234567 },
  indicators: {},
  topContractors: [],
};

const card = (data: AdminDashboard, id: string) =>
  buildPeriodGroups(data)
    .flatMap((g) => g.cards)
    .find((c) => c.id === id)!;

describe("formatação", () => {
  it("sem número mostra —", () => {
    expect(formatInteger(undefined)).toBe(DASH);
    expect(formatPercent(null)).toBe(DASH);
    expect(formatDecimal(null)).toBe(DASH);
    expect(formatCurrencyCents(undefined)).toBe(DASH);
  });

  it("números em pt-BR", () => {
    expect(formatInteger(1234)).toBe("1.234");
    expect(formatPercent(12 / 37)).toBe("32,4%");
    expect(formatDecimal(3)).toBe("3,0");
    expect(formatCurrencyCents(1234567).replace(/\s/g, " ")).toBe("R$ 12.345,67");
  });

  it('"12 de 37"', () => {
    expect(ratioCaption(ratio(12, 37))).toBe("12 de 37");
    expect(ratioCaption(undefined)).toBe(DASH);
  });

  it("horário de Brasília", () => {
    expect(shortDateTimeBrasilia("2026-11-17T22:00:00.000Z")).toBe("17/11 19:00");
  });
});

describe("variação contra o período anterior", () => {
  it("contagem em %; anterior zero mostra a diferença", () => {
    expect(changeText("count", { absolute: 17, percent: 85 }, "out")).toBe("+85% vs. out");
    expect(changeText("count", { absolute: -5, percent: -50 }, "out")).toBe("-50% vs. out");
    expect(changeText("count", { absolute: 5, percent: null }, "out")).toBe("+5; antes 0 vs. out");
  });

  it("taxa em pontos percentuais e nota em pontos", () => {
    expect(changeText("percent", { absolute: 0.031, percent: 10 }, "out")).toBe("+3,1 p.p. vs. out");
    expect(changeText("rating", { absolute: -0.25, percent: -5 }, "out")).toBe("-0,3 vs. out");
  });

  it("sem número de um dos lados: sem comparação", () => {
    expect(changeText("percent", null, "out")).toBe("sem comparação vs. out");
  });

  it("cor respeita o sentido do indicador e o empate fica cinza", () => {
    expect(changeTone({ absolute: 3, percent: 10 })).toBe("text-green-600");
    expect(changeTone({ absolute: 3, percent: 10 }, false)).toBe("text-red-600");
    expect(changeTone({ absolute: 0, percent: 0 })).toBe("text-[#737373]");
    expect(changeTone(null)).toBe("text-[#737373]");
  });
});

describe("cards do período", () => {
  it("API sem os indicadores: todo card mostra — e diz que a versão não devolve", () => {
    const groups = buildPeriodGroups(base);
    expect(groups.map((g) => g.title)).toEqual([
      "Cadastros",
      "Vagas",
      "Conversão e recorrência",
      "Avaliações",
    ]);
    const ids = groups.flatMap((g) => g.cards.map((c) => c.id));
    expect(ids).toEqual(["P1", "P2", "P3", "P4", "P5", "P9", "P7", "P8", "P6", "P11", "P12", "P13"]);
    for (const c of groups.flatMap((g) => g.cards)) {
      expect(c.value).toBe(DASH);
      expect(c.details.calc).toContain("ainda não devolve");
    }
  });

  it("P7 com 12 de 37 e P7 do anterior sem denominador", () => {
    const c = card(
      {
        ...base,
        indicators: {
          contractorActivation: { current: ratio(12, 37), previous: ratio(0, 0), change: null },
        },
      },
      "P7",
    );
    expect(c.value).toBe("32,4%");
    expect(c.caption).toBe("12 de 37 cadastrados");
    expect(c.meta).toBe("novembro/2026 até agora · sem comparação vs. 01/10 a 17/10");
    expect(c.details.calc).toContain("Dos 37 contratantes cadastrados");
    expect(c.details.calc).toContain("Em 01/10 a 17/10: — (0 de 0 cadastrados)");
  });

  it("P9 sem vaga criada mostra — (nunca 0)", () => {
    const c = card(
      {
        ...base,
        indicators: { candidatesPerVacancy: { current: ratio(0, 0), previous: ratio(4, 2), change: null } },
      },
      "P9",
    );
    expect(c.value).toBe(DASH);
  });

  it("P4 com a fatia das vagas criadas; P5 cair é verde", () => {
    const data: AdminDashboard = {
      ...base,
      indicators: {
        vacanciesCompleted: {
          current: 30,
          previous: 24,
          change: { absolute: 6, percent: 25 },
          shareOfCreated: { current: ratio(30, 40), previous: ratio(24, 32) },
        },
        vacanciesEndedWithoutProvider: {
          current: 4,
          previous: 8,
          change: { absolute: -4, percent: -50 },
          shareOfCreated: { current: ratio(4, 40), previous: ratio(8, 32) },
        },
      },
    };
    expect(card(data, "P4").caption).toBe("75,0% das vagas criadas");
    expect(card(data, "P4").details.calc).toContain("30 ÷ 40 vagas criadas no período = 75,0%");
    expect(card(data, "P5").metaColor).toBe("text-green-600");
  });

  it("avaliação com a quantidade e amostra pequena abaixo de 5", () => {
    const data: AdminDashboard = {
      ...base,
      indicators: {
        platformRating: {
          current: { average: 4.25, count: 4, smallSample: true },
          previous: { average: null, count: 0, smallSample: true },
          change: null,
        },
        freelancerRating: {
          current: { average: 4.6, count: 1, smallSample: true },
          previous: { average: 4.4, count: 10, smallSample: false },
          change: { absolute: 0.2, percent: 4.5 },
        },
      },
    };
    const p11 = card(data, "P11");
    expect(p11.value).toBe("4,3");
    expect(p11.caption).toBe("4 avaliações");
    expect(p11.badge).toBe("amostra pequena");
    expect(card(data, "P12").caption).toBe("1 avaliação");
    expect(card(data, "P12").meta).toContain("+0,2 vs.");
  });
});

describe("totais e exclusões", () => {
  it("T1–T3 dizem que são desde o início, com a conta", () => {
    const cards = buildTotalCards(base);
    expect(cards.map((c) => c.id)).toEqual(["T1", "T2", "T3"]);
    expect(cards.every((c) => c.meta === "Desde o início")).toBe(true);
    expect(cards[2].details.calc).toContain("Não é o valor total movimentado (GMV)");
  });

  it("total ausente mostra —", () => {
    const cards = buildTotalCards({ ...base, totals: {} });
    expect(cards.map((c) => c.value)).toEqual([DASH, DASH, DASH]);
  });

  it("texto das contas excluídas", () => {
    expect(exclusionText(base)).toContain("2 contas internas da lista");
    expect(exclusionText({ ...base, exclusions: { excludedAccounts: 0, qaServiceType: "teste" } })).toContain(
      "ADMIN_DASHBOARD_EXCLUDED_USER_IDS vazia",
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  VACANCY_OUTCOME_KEYS,
  type AdminDashboard,
  type DashboardOutcomeSummary,
  type VacancyOutcomeKey,
} from "../infrastructure/dashboard-api";
import {
  DASH,
  VACANCY_OUTCOME_DEFINITIONS,
  buildPeriodGroups,
  buildTotalCards,
  buildVacancyOutcomeView,
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
    expect(formatCurrencyCents(1234567).replace(/\s/g, " ")).toBe(
      "R$ 12.345,67",
    );
  });

  it('"12 de 37"', () => {
    expect(ratioCaption(ratio(12, 37))).toBe("12 de 37");
    expect(ratioCaption(undefined)).toBe(DASH);
  });

  it("horário de Brasília", () => {
    expect(shortDateTimeBrasilia("2026-11-17T22:00:00.000Z")).toBe(
      "17/11 19:00",
    );
  });
});

describe("variação contra o período anterior", () => {
  it("contagem em %; anterior zero mostra a diferença", () => {
    expect(changeText("count", { absolute: 17, percent: 85 }, "out")).toBe(
      "+85% vs. out",
    );
    expect(changeText("count", { absolute: -5, percent: -50 }, "out")).toBe(
      "-50% vs. out",
    );
    expect(changeText("count", { absolute: 5, percent: null }, "out")).toBe(
      "+5; antes 0 vs. out",
    );
  });

  it("taxa em pontos percentuais e nota em pontos", () => {
    expect(changeText("percent", { absolute: 0.031, percent: 10 }, "out")).toBe(
      "+3,1 p.p. vs. out",
    );
    expect(changeText("rating", { absolute: -0.25, percent: -5 }, "out")).toBe(
      "-0,3 vs. out",
    );
  });

  it("sem número de um dos lados: sem comparação", () => {
    expect(changeText("percent", null, "out")).toBe("sem comparação vs. out");
  });

  it("cor respeita o sentido do indicador e o empate fica cinza", () => {
    expect(changeTone({ absolute: 3, percent: 10 })).toBe("text-green-600");
    expect(changeTone({ absolute: 3, percent: 10 }, false)).toBe(
      "text-red-600",
    );
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
    expect(ids).toEqual([
      "P1",
      "P2",
      "P3",
      "P4",
      "P5",
      "P9",
      "P7",
      "P8",
      "P6",
      "P11",
      "P12",
      "P13",
    ]);
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
          contractorActivation: {
            current: ratio(12, 37),
            previous: ratio(0, 0),
            change: null,
          },
        },
      },
      "P7",
    );
    expect(c.value).toBe("32,4%");
    expect(c.caption).toBe("12 de 37 cadastrados");
    expect(c.meta).toBe(
      "novembro/2026 até agora · sem comparação vs. 01/10 a 17/10",
    );
    expect(c.details.calc).toContain("Dos 37 contratantes cadastrados");
    expect(c.details.calc).toContain(
      "Em 01/10 a 17/10: — (0 de 0 cadastrados)",
    );
  });

  it("P9 sem vaga criada mostra — (nunca 0)", () => {
    const c = card(
      {
        ...base,
        indicators: {
          candidatesPerVacancy: {
            current: ratio(0, 0),
            previous: ratio(4, 2),
            change: null,
          },
        },
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
    expect(card(data, "P4").details.calc).toContain(
      "30 ÷ 40 vagas criadas no período = 75,0%",
    );
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
    expect(cards[2].details.calc).toContain(
      "Não é o valor total movimentado (GMV)",
    );
  });

  it("total ausente mostra —", () => {
    const cards = buildTotalCards({ ...base, totals: {} });
    expect(cards.map((c) => c.value)).toEqual([DASH, DASH, DASH]);
  });

  it("texto das contas excluídas", () => {
    expect(exclusionText(base)).toContain("2 contas internas da lista");
    expect(
      exclusionText({
        ...base,
        exclusions: { excludedAccounts: 0, qaServiceType: "teste" },
      }),
    ).toContain("ADMIN_DASHBOARD_EXCLUDED_USER_IDS vazia");
  });
});

describe("destino das vagas criadas e faltas", () => {
  const summary = (
    counts: Partial<Record<VacancyOutcomeKey, number>>,
  ): DashboardOutcomeSummary => {
    const byOutcome = Object.fromEntries(
      VACANCY_OUTCOME_KEYS.map((k) => [k, counts[k] ?? 0]),
    ) as Record<VacancyOutcomeKey, number>;
    const values = Object.entries(byOutcome);
    const fake = values
      .filter(([k]) => k.startsWith("FAKE_"))
      .reduce((a, [, n]) => a + n, 0);
    const test = values
      .filter(([k]) => k.startsWith("TEST_"))
      .reduce((a, [, n]) => a + n, 0);
    const total = values.reduce((a, [, n]) => a + n, 0);
    return {
      total,
      official: total - fake - test,
      fake,
      test,
      byOutcome,
      officialCandidates: 0,
    };
  };
  const noShow = {
    occurrences: 5,
    people: 4,
    vacancies: 3,
    noWarning: 3,
    lateWithdrawal: 2,
    contested: 1,
    warnedWithdrawals: 2,
    notConfirmed: 1,
  };
  const withOutcomes: AdminDashboard = {
    ...base,
    indicators: {
      vacanciesCreated: {
        current: 8,
        previous: 5,
        change: { absolute: 3, percent: 60 },
      },
      vacanciesEndedWithoutProvider: {
        current: 1,
        previous: 1,
        change: { absolute: 0, percent: 0 },
        shareOfCreated: { current: ratio(1, 8), previous: ratio(1, 5) },
      },
    },
    vacancyOutcomes: {
      quickCancelMinutes: 45,
      current: summary({
        COMPLETED: 4,
        OPEN_WITH_CANDIDATES: 2,
        NO_SHOW: 1,
        NO_FREELANCER: 1,
        FAKE_QUICK: 3,
        FAKE_CANCELLED_WITH_CANDIDATES: 2,
        TEST_QA: 1,
      }),
      previous: summary({ COMPLETED: 5 }),
      previousRule: { vacanciesCreated: 13, endedWithoutProvider: 3 },
    },
    noShows: {
      current: noShow,
      previous: { ...noShow, occurrences: 4 },
      change: { absolute: 1, percent: 25 },
    },
  };

  it("todas as categorias da API têm nome e definição", () => {
    for (const key of VACANCY_OUTCOME_KEYS) {
      expect(VACANCY_OUTCOME_DEFINITIONS[key].title.length).toBeGreaterThan(0);
      expect(VACANCY_OUTCOME_DEFINITIONS[key].what.length).toBeGreaterThan(0);
    }
  });

  it("sem os blocos na API: null (a tela avisa)", () => {
    expect(buildVacancyOutcomeView(base)).toBeNull();
  });

  it("topo: total = oficiais + falsas + teste, com a conta", () => {
    const view = buildVacancyOutcomeView(withOutcomes)!;
    const total = view.summary.find((c) => c.id === "VO-TOTAL")!;
    expect(total.value).toBe("14");
    expect(total.caption).toBe("8 oficiais · 5 falsas · 1 de teste");
    expect(total.details.calc).toContain(
      "14 = 8 oficiais + 5 falsas + 1 de teste",
    );
    const fake = view.summary.find((c) => c.id === "VO-FAKE")!;
    expect(fake.details.calc).toContain("3 abertas e fechadas rápido");
    expect(fake.details.calc).toContain("até 45 min");
  });

  it("oficiais destrinchadas: toda categoria oficial aparece uma vez, com % das oficiais e o ?", () => {
    const view = buildVacancyOutcomeView(withOutcomes)!;
    const rows = view.officialGroups.flatMap((g) => g.rows);
    const officialKeys = VACANCY_OUTCOME_KEYS.filter(
      (k) => !k.startsWith("FAKE_") && !k.startsWith("TEST_"),
    );
    expect(rows.map((r) => r.id).sort()).toEqual([...officialKeys].sort());
    const completed = rows.find((r) => r.id === "COMPLETED")!;
    expect(completed.value).toBe("4");
    expect(completed.share).toBe("50,0%");
    expect(completed.help).toContain("4 de 8 vagas oficiais");
    expect(completed.help).toContain("Em 01/10 a 17/10: 5");
    const sumRows = rows.reduce((acc, r) => acc + Number(r.value), 0);
    expect(sumRows).toBe(8);
  });

  it("um card por tipo de vaga falsa, com o limite do rápido no texto", () => {
    const view = buildVacancyOutcomeView(withOutcomes)!;
    expect(view.fakeCards.map((c) => c.id)).toEqual([
      "FAKE_QUICK",
      "FAKE_DELETED",
      "FAKE_CANCELLED_WITH_CANDIDATES",
      "FAKE_EXPIRED_WITH_CANDIDATES",
    ]);
    expect(view.fakeCards[0].details.calc).toContain("até 45 min");
    expect(view.fakeCards[0].details.calc).not.toContain("{X}");
  });

  it("faltas: pessoas em vagas, subtotais e os dois detalhes fora", () => {
    const [official, warned, notConfirmed] =
      buildVacancyOutcomeView(withOutcomes)!.noShowCards;
    expect(official.value).toBe("5");
    expect(official.caption).toBe("4 pessoas em 3 vagas");
    expect(official.badge).toBe("1 em contestação");
    expect(official.details.calc).toContain("3 faltaram sem avisar");
    expect(official.details.calc).toContain("2 desistiram a menos de 6 h");
    expect(official.metaColor).toBe("text-red-600");
    expect(warned.value).toBe("2");
    expect(notConfirmed.value).toBe("1");
  });

  it("P3 e P5 dizem que contam sem as vagas falsas e mostram a regra de antes", () => {
    const p3 = card(withOutcomes, "P3");
    expect(p3.title).toBe("Vagas criadas (sem vagas falsas)");
    expect(p3.details.calc).toContain(
      "8 oficiais = 14 criadas no total − 5 falsas − 1 de teste",
    );
    expect(p3.details.calc).toContain(
      "Pela regra de antes (só sem as apagadas e as de QA): 13",
    );
    expect(card(withOutcomes, "P5").details.calc).toContain(
      "Pela regra de antes",
    );
    expect(card(base, "P3").title).toBe("Vagas criadas");
  });
});

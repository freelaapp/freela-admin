import { describe, expect, it } from "vitest";
import {
  SAMPLE_CONTRACTOR_DETAIL,
  SAMPLE_OVERVIEW,
  SAMPLE_OVERVIEW_BEFORE_MEASUREMENT,
} from "./engagement.test-fixtures";
import {
  ALL_METRIC_GROUPS,
  CLIENT_REPORT_NUMBERS,
  CONTRACTOR_DETAIL_NUMBERS,
  OVERVIEW_HIGHLIGHTS,
  SERIES_LINES,
  contractorFunnel,
  freelancerFunnel,
  funnelBars,
} from "./engagement-metrics";

const ALL = ALL_METRIC_GROUPS.flatMap((g) => g.metrics);

describe("definições dos números", () => {
  it("cada grupo tem rótulos únicos, ajuda e valor no fixture", () => {
    for (const g of ALL_METRIC_GROUPS) {
      const labels = g.metrics.map((d) => d.label);
      expect(new Set(labels).size).toBe(labels.length);
      for (const d of g.metrics) {
        expect(d.help.length).toBeGreaterThan(20);
        expect(d.pick(SAMPLE_OVERVIEW)).toHaveProperty("current");
      }
    }
  });

  it("onde subir é ruim, a cor inverte", () => {
    expect(ALL.filter((d) => !d.higherIsBetter).map((d) => d.label)).toEqual([
      "Abriram e não se candidataram",
      "Abriram e não publicaram",
      "Canceladas pela empresa",
      "Canceladas pelo admin",
      "Canceladas pelo sistema",
      "Sem candidato",
      "Tempo até a 1ª candidatura",
    ]);
  });

  it("as aberturas são marcadas para ganhar o aviso de medição", () => {
    expect(ALL.filter((d) => d.opened).map((d) => d.key)).toEqual([
      "freelancers.opened",
      "freelancers.openedNoApply",
      "contractors.opened",
      "contractors.openedNoPublish",
    ]);
  });

  it("os destaques da visão geral dizem de quem é o número", () => {
    expect(OVERVIEW_HIGHLIGHTS.map((d) => d.label)).toEqual([
      "Freelancers que abriram",
      "Abriram e não se candidataram",
      "Freelancers que se candidataram",
      "Empresas que abriram",
      "Empresas que publicaram vaga",
      "Vagas publicadas",
      "Vagas concluídas",
      "Candidaturas por vaga",
    ]);
  });

  it("séries e relatório do cliente", () => {
    expect(SERIES_LINES.map((l) => l.key)).toEqual([
      "vacanciesPublished",
      "vacanciesCompleted",
      "candidacies",
      "freelancersOpened",
      "contractorsOpened",
    ]);
    expect(CLIENT_REPORT_NUMBERS.map((d) => d.key)).not.toContain("activeDays");
    expect(
      CONTRACTOR_DETAIL_NUMBERS.find((d) => d.key === "contractedCents")?.pick(SAMPLE_CONTRACTOR_DETAIL),
    ).toEqual({ current: 36000, previous: 18000 });
  });
});

describe("funis", () => {
  it("% sobre o 1º passo e largura sobre o maior", () => {
    const bars = funnelBars(freelancerFunnel(SAMPLE_OVERVIEW));
    expect(bars.map((b) => b.value)).toEqual([4, 2, 2, 2]);
    expect(bars.map((b) => b.share)).toEqual([100, 50, 50, 50]);
    expect(bars.map((b) => b.width)).toEqual([100, 50, 50, 50]);
    expect(funnelBars(contractorFunnel(SAMPLE_OVERVIEW)).map((b) => b.share)).toEqual([100, 67, 67]);
  });

  it("antes da medição: 1º passo sem número → sem %, e a barra dele vazia", () => {
    const bars = funnelBars(freelancerFunnel(SAMPLE_OVERVIEW_BEFORE_MEASUREMENT));
    expect(bars[0]).toMatchObject({ value: null, share: null, width: 0 });
    expect(bars.map((b) => b.share)).toEqual([null, null, null, null]);
    expect(bars.map((b) => b.width)).toEqual([0, 100, 100, 100]);
  });
});

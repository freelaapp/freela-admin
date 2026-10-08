import { describe, expect, it } from "vitest";
import type { EngagementIndicators } from "../infrastructure/engagement-api";
import {
  SAMPLE_CONTRACTOR_DETAIL,
  SAMPLE_OVERVIEW,
  SAMPLE_OVERVIEW_BEFORE_MEASUREMENT,
} from "./engagement.test-fixtures";
import {
  CLIENT_REPORT_NUMBERS,
  CONTRACTOR_DETAIL_NUMBERS,
  CONTRACTOR_INDICATORS,
  FREELANCER_INDICATORS,
  INDICATOR_TABLES,
  SERIES_LINES,
  VACANCY_METRICS,
  indicatorParts,
  indicatorSource,
  type IndicatorDef,
} from "./engagement-metrics";

const I = SAMPLE_OVERVIEW.indicators as EngagementIndicators;
const byLabel = (defs: IndicatorDef[], label: string) => defs.find((d) => d.label === label) as IndicatorDef;
const parts = (defs: IndicatorDef[], label: string, side: "current" | "previous" = "current") =>
  indicatorParts(byLabel(defs, label), I, side);

describe("números da aba Vagas (cartões)", () => {
  it("rótulos únicos, ajuda e valor no fixture", () => {
    const labels = VACANCY_METRICS.map((d) => d.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const d of VACANCY_METRICS) {
      expect(d.help.length).toBeGreaterThan(20);
      expect(d.pick(SAMPLE_OVERVIEW)).toHaveProperty("current");
    }
  });

  it("onde subir é ruim, a cor inverte", () => {
    expect(VACANCY_METRICS.filter((d) => !d.higherIsBetter).map((d) => d.label)).toEqual([
      "Canceladas pela empresa",
      "Canceladas pelo admin",
      "Canceladas pelo sistema",
      "Sem candidato",
      "Tempo até a 1ª candidatura",
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

describe("indicadores da diretoria", () => {
  it("exatamente as linhas pedidas, na ordem", () => {
    expect(INDICATOR_TABLES.map((t) => t.title)).toEqual(["Contratante", "Freelancer"]);
    expect(CONTRACTOR_INDICATORS.map((d) => d.label)).toEqual([
      "Cadastrou",
      "Abriu a 1ª vaga",
      "Tempo até a 1ª vaga",
      "Acessou",
      "Ativo",
      "Vagas por contratante ativo",
      "Vagas preenchidas",
      "Voltou",
      "Faturamento",
      "Receita do Freela",
    ]);
    expect(FREELANCER_INDICATORS.map((d) => d.label)).toEqual([
      "Cadastrou",
      "Ativo",
      "Candidaturas por freela ativo",
      "Serviços por freela",
      "Candidatou e não trabalhou",
      "Voltou",
    ]);
  });

  it("toda linha diz como calcula e de onde vem, e tem valor no fixture", () => {
    for (const d of [...CONTRACTOR_INDICATORS, ...FREELANCER_INDICATORS]) {
      expect(d.how.length).toBeGreaterThan(15);
      expect(d.source.length).toBeGreaterThan(15);
      expect(d.pick(I)).toHaveProperty("current");
    }
  });

  it("menor é melhor só no tempo até a 1ª vaga e em 'candidatou e não trabalhou'", () => {
    const worse = [...CONTRACTOR_INDICATORS, ...FREELANCER_INDICATORS].filter((d) => !d.higherIsBetter);
    expect(worse.map((d) => d.key)).toEqual(["contractors.medianDaysToFirstVacancy", "freelancers.appliedNotWorked"]);
  });

  it("formatos: %, dias, razão e dinheiro", () => {
    expect(byLabel(CONTRACTOR_INDICATORS, "Abriu a 1ª vaga").kind).toBe("pct");
    expect(byLabel(CONTRACTOR_INDICATORS, "Tempo até a 1ª vaga").kind).toBe("days");
    expect(byLabel(CONTRACTOR_INDICATORS, "Vagas por contratante ativo").kind).toBe("ratio");
    expect(byLabel(CONTRACTOR_INDICATORS, "Receita do Freela").kind).toBe("brl");
    expect(byLabel(FREELANCER_INDICATORS, "Serviços por freela").kind).toBe("ratio");
  });

  it("parcelas do período, no texto pedido", () => {
    expect(parts(CONTRACTOR_INDICATORS, "Abriu a 1ª vaga")).toBe("2 de 5 cadastrados");
    expect(parts(CONTRACTOR_INDICATORS, "Tempo até a 1ª vaga")).toBe("entre 2 que abriram");
    expect(parts(CONTRACTOR_INDICATORS, "Vagas por contratante ativo")).toBe("3 vagas ÷ 2 ativos");
    expect(parts(CONTRACTOR_INDICATORS, "Vagas preenchidas")).toBe("2 de 3 vagas");
    expect(parts(CONTRACTOR_INDICATORS, "Voltou")).toBe("1 de 1 ativo do período anterior (100%)");
    expect(parts(FREELANCER_INDICATORS, "Candidaturas por freela ativo")).toBe("2 candidaturas ÷ 2 ativos");
    expect(parts(FREELANCER_INDICATORS, "Serviços por freela")).toBe("3 serviços ÷ 2 freelas que trabalharam");
    expect(parts(FREELANCER_INDICATORS, "Candidatou e não trabalhou")).toBe("1 de 2 ativos (50%)");
    expect(parts(FREELANCER_INDICATORS, "Voltou")).toBe("1 de 1 que trabalhou antes (100%)");
    // Contagens e dinheiro não têm conta para mostrar.
    for (const label of ["Cadastrou", "Ativo", "Faturamento", "Receita do Freela"]) {
      expect(parts(CONTRACTOR_INDICATORS, label)).toBeNull();
    }
  });

  it("parcelas do anterior: singular, base 0 sem % e 'voltou' contra o período antes do anterior", () => {
    expect(parts(CONTRACTOR_INDICATORS, "Abriu a 1ª vaga", "previous")).toBe("1 de 3 cadastrados");
    expect(parts(CONTRACTOR_INDICATORS, "Tempo até a 1ª vaga", "previous")).toBe("entre 1 que abriu");
    expect(parts(CONTRACTOR_INDICATORS, "Vagas por contratante ativo", "previous")).toBe("1 vaga ÷ 1 ativo");
    expect(parts(CONTRACTOR_INDICATORS, "Voltou", "previous")).toBe(
      "0 de 2 ativos do período antes do anterior (0%)",
    );
    expect(parts(FREELANCER_INDICATORS, "Voltou", "previous")).toBe(
      "0 de 0 que trabalharam no período antes do anterior",
    );
  });

  it("a conta fecha: % e razão são as parcelas divididas", () => {
    const ratio = (a: number, b: number) => Math.round((a / b) * 100) / 100;
    const pct = (a: number, b: number) => Math.round((a / b) * 1000) / 10;
    const c = I.contractors;
    const f = I.freelancers;
    expect(c.firstVacancyPct.current).toBe(pct(c.firstVacancyCount.current!, c.signedUp.current!));
    expect(c.vacanciesPerActive.current).toBe(ratio(c.vacancies.current!, c.active.current!));
    expect(c.filledPct.current).toBe(pct(c.completedFromOpened.current!, c.vacancies.current!));
    expect(c.returnedPct.current).toBe(pct(c.returned.current!, c.returnedBase.current!));
    expect(f.candidaciesPerActive.current).toBe(ratio(f.candidacies.current!, f.active.current!));
    expect(f.servicesPerWorker.current).toBe(ratio(f.services.current!, f.worked.current!));
    expect(f.appliedNotWorkedPct.current).toBe(pct(f.appliedNotWorked.current!, f.active.current!));
  });

  it("acessos: a fonte diz desde quando mede; sem medição, as parcelas dizem isso", () => {
    const accessed = byLabel(CONTRACTOR_INDICATORS, "Acessou");
    expect(indicatorSource(accessed, "2026-10-07")).toBe(
      'Registro de acessos (medido desde 07/10/2026; antes disso aparece "—")',
    );
    expect(indicatorSource(accessed, null)).toBe('Registro de acessos (ainda sem medição; aparece "—")');
    expect(indicatorSource(byLabel(CONTRACTOR_INDICATORS, "Ativo"), "2026-10-07")).toBe(
      "Vagas abertas no período (data de criação), por contratante",
    );
    const before = SAMPLE_OVERVIEW_BEFORE_MEASUREMENT.indicators as EngagementIndicators;
    expect(indicatorParts(accessed, before, "current")).toBe("sem medição neste período");
    expect(indicatorParts(accessed, I, "current")).toBeNull();
  });
});

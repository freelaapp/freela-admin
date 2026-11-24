import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, post: vi.fn(), patch: vi.fn() }),
}));

import {
  DashboardUnavailableError,
  getAdminDashboard,
  getVacancyStages,
} from "./dashboard-api";
import { serviceDateBlock } from "../application/__tests__/dashboard-service-date.fixture";

const ratio = (numerator: number, denominator: number) => ({
  value: denominator ? numerator / denominator : null,
  numerator,
  denominator,
});

const fullPayload = {
  generatedAt: "2026-11-17T13:00:00.000Z",
  period: {
    preset: "this_month",
    start: "2026-11-01T03:00:00.000Z",
    end: "2026-11-17T13:00:00.000Z",
    previousStart: "2026-10-01T03:00:00.000Z",
    previousEnd: "2026-10-17T13:00:00.000Z",
    label: "novembro/2026 até agora",
    previousLabel: "01/10/2026 a 17/10/2026, até a mesma hora",
  },
  exclusions: { excludedAccounts: 1, qaServiceType: "teste" },
  totals: { freelancers: 1200, contractors: 85, platformRevenueCents: 1234567 },
  indicators: {
    freelancerSignups: { current: 37, previous: 20, change: { absolute: 17, percent: 85 } },
    contractorActivation: { current: ratio(12, 37), previous: ratio(0, 0), change: null },
  },
  topContractors: [],
};

function notFound() {
  return new AxiosError("Not Found", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 404,
    statusText: "Not Found",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAdminDashboard", () => {
  it("manda o período e só manda from/to no personalizado", async () => {
    get.mockResolvedValue({ data: { data: fullPayload } });
    await getAdminDashboard({ period: "7d", from: "2026-11-01", to: "2026-11-10" });
    expect(get).toHaveBeenCalledWith("/dashboard", { params: { period: "7d" } });

    await getAdminDashboard({ period: "custom", from: "2026-11-01", to: "2026-11-10" });
    expect(get).toHaveBeenLastCalledWith("/dashboard", {
      params: { period: "custom", from: "2026-11-01", to: "2026-11-10" },
    });
  });

  it("indicador ausente vira undefined e não derruba os outros", async () => {
    get.mockResolvedValue({ data: { data: fullPayload } });
    const out = await getAdminDashboard({});
    expect(out.indicators.freelancerSignups?.current).toBe(37);
    expect(out.indicators.contractorActivation?.current.value).toBeCloseTo(12 / 37);
    expect(out.indicators.contractorActivation?.previous.value).toBeNull();
    expect(out.indicators.platformRating).toBeUndefined();
    expect(out.totals.platformRevenueCents).toBe(1234567);
  });

  it("destino das vagas e faltas: lê os blocos; categoria desconhecida não quebra e falta vira 0", async () => {
    const summary = (total: number) => ({
      total,
      official: total,
      fake: 0,
      test: 0,
      byOutcome: { COMPLETED: total, CATEGORIA_NOVA: 3 },
      officialCandidates: 0,
    });
    const noShow = {
      occurrences: 2,
      people: 2,
      vacancies: 1,
      noWarning: 1,
      lateWithdrawal: 1,
      contested: 0,
      warnedWithdrawals: 0,
      notConfirmed: 0,
    };
    get.mockResolvedValue({
      data: {
        data: {
          ...fullPayload,
          vacancyOutcomes: {
            quickCancelMinutes: 60,
            current: summary(5),
            previous: summary(2),
            previousRule: { vacanciesCreated: 6, endedWithoutProvider: 1 },
          },
          noShows: {
            current: noShow,
            previous: noShow,
            change: { absolute: 0, percent: 0 },
          },
        },
      },
    });
    const out = await getAdminDashboard({});
    expect(out.vacancyOutcomes?.current.byOutcome.COMPLETED).toBe(5);
    expect(out.vacancyOutcomes?.current.byOutcome.FAKE_QUICK).toBe(0);
    expect(out.vacancyOutcomes?.current.byOutcome).not.toHaveProperty(
      "CATEGORIA_NOVA",
    );
    expect(out.noShows?.current.occurrences).toBe(2);
  });

  it("API de antes de 18/11 (sem os blocos novos): ficam undefined", async () => {
    get.mockResolvedValue({ data: { data: fullPayload } });
    const out = await getAdminDashboard({});
    expect(out.vacancyOutcomes).toBeUndefined();
    expect(out.noShows).toBeUndefined();
  });

  it("vagas pela data do serviço: lê o bloco (grupos, falsas, cobertas, média, destino)", async () => {
    get.mockResolvedValue({
      data: { data: { ...fullPayload, vacanciesByServiceDate: serviceDateBlock() } },
    });
    const out = await getAdminDashboard({});
    const block = out.vacanciesByServiceDate!;
    expect(block.total.current).toBe(10);
    expect(block.groups.map((g) => g.key)).toEqual([
      "COMPLETED",
      "NO_SHOW",
      "NO_FREELANCER",
      "CANCELLED",
      "HAPPENING_OR_CLOSING",
      "UPCOMING",
      "OUT_OF_PATTERN",
    ]);
    expect(block.groups[1].change).toBeNull();
    expect(block.groups[0].shareOfTotal?.current.value).toBeCloseTo(0.6);
    expect(block.coveredNoShows?.current).toBe(2);
    expect(block.candidatesPerVacancy?.current.value).toBeCloseTo(16.8);
    expect(block.fake.current).toBe(3);
    expect(block.byOutcome.current.FAKE_QUICK).toBe(2);
    // Os campos antigos seguem como estavam.
    expect(out.indicators.freelancerSignups?.current).toBe(37);
  });

  it("API sem o bloco novo ou com o bloco malformado: undefined, resto intacto", async () => {
    get.mockResolvedValue({ data: { data: fullPayload } });
    expect((await getAdminDashboard({})).vacanciesByServiceDate).toBeUndefined();
    get.mockResolvedValue({
      data: { data: { ...fullPayload, vacanciesByServiceDate: { base: "SERVICE_DATE", total: "dez" } } },
    });
    const out = await getAdminDashboard({});
    expect(out.vacanciesByServiceDate).toBeUndefined();
    expect(out.indicators.freelancerSignups?.current).toBe(37);
  });

  it("bloco novo: cobertas e média ausentes não derrubam o bloco; categoria nova vira 0", async () => {
    const block = serviceDateBlock() as unknown as Record<string, unknown>;
    delete block.coveredNoShows;
    delete block.candidatesPerVacancy;
    (block.byOutcome as { current: Record<string, number> }).current.BRAND_NEW = 4;
    get.mockResolvedValue({ data: { data: { ...fullPayload, vacanciesByServiceDate: block } } });
    const out = await getAdminDashboard({});
    expect(out.vacanciesByServiceDate?.coveredNoShows).toBeUndefined();
    expect(out.vacanciesByServiceDate?.candidatesPerVacancy).toBeUndefined();
    expect(out.vacanciesByServiceDate?.byOutcome.current).not.toHaveProperty("BRAND_NEW");
    expect(out.vacanciesByServiceDate?.total.current).toBe(10);
  });

  it("bloco novo: change ausente em total, falsas, teste e cobertas não descarta o bloco", async () => {
    const block = serviceDateBlock() as unknown as Record<string, Record<string, unknown>>;
    for (const key of ["total", "fake", "test", "coveredNoShows"]) delete block[key].change;
    get.mockResolvedValue({ data: { data: { ...fullPayload, vacanciesByServiceDate: block } } });
    const out = await getAdminDashboard({});
    expect(out.vacanciesByServiceDate).toBeDefined();
    expect(out.vacanciesByServiceDate?.total.change).toBeNull();
    expect(out.vacanciesByServiceDate?.fake.change).toBeNull();
    expect(out.vacanciesByServiceDate?.test.change).toBeNull();
    expect(out.vacanciesByServiceDate?.coveredNoShows?.change).toBeNull();
    expect(out.vacanciesByServiceDate?.total.current).toBe(10);
  });

  it("indicador malformado vira undefined; o resto continua", async () => {
    get.mockResolvedValue({
      data: {
        data: {
          ...fullPayload,
          indicators: { ...fullPayload.indicators, vacanciesCreated: { current: "dez" } },
        },
      },
    });
    const out = await getAdminDashboard({});
    expect(out.indicators.vacanciesCreated).toBeUndefined();
    expect(out.indicators.freelancerSignups?.current).toBe(37);
  });

  it("404 (API sem a rota nova) vira DashboardUnavailableError", async () => {
    get.mockRejectedValue(notFound());
    await expect(getAdminDashboard({})).rejects.toBeInstanceOf(DashboardUnavailableError);
  });

  it("outro erro passa adiante como está", async () => {
    const boom = new Error("rede");
    get.mockRejectedValue(boom);
    await expect(getAdminDashboard({})).rejects.toBe(boom);
  });
});

describe("getVacancyStages", () => {
  it("lê as etapas; etapa ausente vira undefined", async () => {
    get.mockResolvedValue({
      data: {
        data: {
          generatedAt: "2026-11-17T13:00:00.000Z",
          scope: "today",
          dayStart: "2026-11-17T03:00:00.000Z",
          dayEnd: "2026-11-18T03:00:00.000Z",
          stages: { S1: { count: 2, alerts: 1, vacancies: [], truncated: false } },
        },
      },
    });
    const out = await getVacancyStages("today");
    expect(get).toHaveBeenCalledWith("/dashboard/vacancy-stages", { params: { scope: "today" } });
    expect(out.stages.S1?.count).toBe(2);
    expect(out.stages.S2).toBeUndefined();
  });

  it("404 vira DashboardUnavailableError", async () => {
    get.mockRejectedValue(notFound());
    await expect(getVacancyStages("upcoming")).rejects.toBeInstanceOf(DashboardUnavailableError);
  });
});

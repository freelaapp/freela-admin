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

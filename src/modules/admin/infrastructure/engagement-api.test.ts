import { beforeEach, describe, expect, it, vi } from "vitest";

// Mesmo padrão de campaign-templates-api.test.ts (vi.hoisted evita o hoisting trap).
const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get }),
}));

import {
  engagementListQuery,
  engagementQuery,
  getContractorEngagement,
  getEngagementOverview,
  listEngagementFreelancers,
  type EngagementFilters,
} from "./engagement-api";

const BASE: EngagementFilters = {
  period: "this_month",
  from: "2026-09-08",
  to: "2026-10-07",
  city: "",
  uf: "",
  product: "all",
  channel: "all",
};

beforeEach(() => get.mockReset());

describe("engagementQuery", () => {
  it("o padrão não manda nada (a API já cai no mês corrente)", () => {
    expect(engagementQuery(BASE)).toEqual({});
  });

  it("from/to só no personalizado", () => {
    expect(engagementQuery({ ...BASE, period: "7d" })).toEqual({ period: "7d" });
    expect(engagementQuery({ ...BASE, period: "custom", from: "2026-09-01", to: "2026-09-30" })).toEqual({
      period: "custom",
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("cidade, UF, produto e canal quando escolhidos", () => {
    expect(
      engagementQuery({ ...BASE, city: "Juiz de Fora", uf: "MG", product: "home_services", channel: "app" }),
    ).toEqual({ city: "Juiz de Fora", uf: "MG", product: "home_services", channel: "app" });
  });
});

describe("engagementListQuery", () => {
  it("página, limite, segmento, busca aparada e contas sem acesso", () => {
    expect(
      engagementListQuery(BASE, {
        segment: "opened_no_apply",
        search: "  ana ",
        includeNoAccess: true,
        page: 2,
        limit: 25,
      }),
    ).toEqual({ segment: "opened_no_apply", search: "ana", includeNoAccess: "true", page: "2", limit: "25" });
  });

  it("exportação manda export=1 e nem página nem limite", () => {
    expect(engagementListQuery(BASE, { page: 3, limit: 25, exportAll: true })).toEqual({ export: "1" });
  });
});

describe("chamadas", () => {
  it("overview devolve o miolo do envelope", async () => {
    get.mockResolvedValue({ data: { data: { measuredSince: null } } });
    await expect(getEngagementOverview({ ...BASE, period: "30d" })).resolves.toEqual({ measuredSince: null });
    expect(get).toHaveBeenCalledWith("/overview", { params: { period: "30d" } });
  });

  it("lista junta linhas e meta, inclusive o corte da exportação", async () => {
    get.mockResolvedValue({
      data: { data: [{ userId: "u1" }], meta: { total: 25000, page: 1, limit: 20000, truncated: true } },
    });
    await expect(listEngagementFreelancers(BASE, { exportAll: true })).resolves.toEqual({
      rows: [{ userId: "u1" }],
      total: 25000,
      page: 1,
      limit: 20000,
      truncated: true,
    });
    expect(get).toHaveBeenCalledWith("/freelancers", { params: { export: "1" } });
  });

  it("ficha codifica o id e manda só o período (a API ignora o resto nas fichas)", async () => {
    get.mockResolvedValue({ data: { data: { ok: true } } });
    await getContractorEngagement("a/b c", {
      ...BASE,
      period: "last_month",
      city: "Gramado",
      uf: "RS",
      channel: "web",
    });
    expect(get).toHaveBeenCalledWith("/contractors/a%2Fb%20c", { params: { period: "last_month" } });
  });
});

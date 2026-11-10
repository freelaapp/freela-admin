import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get }),
}));

import { getAdminLot, getAdminLotByVacancy, getAdminLots } from "./lots-api";

const lot = (over: Record<string, unknown> = {}) => ({
  id: "lot-1",
  serviceDate: "2026-11-14",
  trigger: "EQUAL_GROUP",
  createdAt: "2026-11-10T12:00:00.000Z",
  past: false,
  nextStep: "CHOOSE",
  promiseCorrectedAt: null,
  totals: { vacancies: 18, functions: 3, chosen: 7, paid: 0, free: 11, candidatesToChoose: 13, chosenUnpaid: 7, cancelled: 0 },
  groups: [
    {
      groupKey: "a".repeat(64),
      title: "Garçom",
      serviceType: "garcom",
      categorySlug: null,
      pricingTierLabel: null,
      startTime: "2026-11-14T21:00:00.000Z",
      endTime: "2026-11-15T02:00:00.000Z",
      freelancerNetInCents: 13728,
      address: null,
      vacancies: 12,
      chosen: 5,
      paid: 0,
      free: 7,
      candidatesToChoose: 9,
      representativeVacancyId: "vac-1",
      vacancyIds: ["vac-1", "vac-2"],
    },
  ],
  inSelection: [],
  contractorId: "c1",
  companyName: "Buffet Villa",
  firstStartTime: "2026-11-14T21:00:00.000Z",
  attention: ["FREE_SOON"],
  ...over,
});

describe("lots-api", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lista: valida cada lote e ignora valores em reais", async () => {
    get.mockResolvedValue({ data: { data: [lot()] } });
    const res = await getAdminLots();
    expect(get).toHaveBeenCalledWith("/lots", { params: undefined });
    expect(res).toHaveLength(1);
    expect(res[0].companyName).toBe("Buffet Villa");
    expect(res[0].attention).toEqual(["FREE_SOON"]);
    expect(res[0].groups[0]).not.toHaveProperty("freelancerNetInCents");
  });

  it("campos opcionais ausentes viram padrão (API um pouco diferente não derruba)", async () => {
    get.mockResolvedValue({
      data: { data: { id: "l", serviceDate: "2026-11-14", totals: { vacancies: 3 } } },
    });
    const res = await getAdminLot("l");
    expect(res.groups).toEqual([]);
    expect(res.attention).toEqual([]);
    expect(res.totals.free).toBe(0);
    expect(res.companyName).toBeNull();
  });

  it("valor de enum novo passa como texto", async () => {
    get.mockResolvedValue({ data: { data: lot({ nextStep: "NOVO_PASSO", attention: ["OUTRO"] }) } });
    const res = await getAdminLot("lot-1");
    expect(res.nextStep).toBe("NOVO_PASSO");
  });

  it("resposta sem forma de lote é rejeitada", async () => {
    get.mockResolvedValue({ data: { data: [{ id: 1 }] } });
    await expect(getAdminLots()).rejects.toThrow();
  });

  it("por vaga: lot e besideLot nulos", async () => {
    get.mockResolvedValue({ data: { data: { lot: null, besideLot: null } } });
    expect(await getAdminLotByVacancy("v1")).toEqual({ lot: null, besideLot: null });
    expect(get).toHaveBeenCalledWith("/lots/by-vacancy/v1");
  });

  it("por vaga: com lote", async () => {
    get.mockResolvedValue({ data: { data: { lot: lot(), besideLot: null } } });
    const res = await getAdminLotByVacancy("v1");
    expect(res.lot?.id).toBe("lot-1");
    expect(res.besideLot).toBeNull();
  });
});

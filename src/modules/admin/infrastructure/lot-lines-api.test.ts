import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get }),
}));

import { getAdminLotLines } from "./lot-lines-api";

const line = (over: Record<string, unknown> = {}) => ({
  vacancyId: "v1",
  groupKey: "k1",
  title: "Garçom",
  startTime: "2026-11-14T21:00:00.000Z",
  endTime: "2026-11-15T02:00:00.000Z",
  status: "CLOSED",
  chosen: { candidacyId: "c1", providerGlobalId: "g1", name: "Ana Souza" },
  ask: {
    state: "YES",
    askedForVacancyId: "v1",
    scheduledFor: null,
    askedAt: "2026-11-13T17:02:04.000Z",
    deadlineAt: null,
    answeredAt: "2026-11-13T17:12:31.000Z",
    answeredVia: "WHATSAPP",
    deliveredAt: "2026-11-13T17:02:05.000Z",
    closedAt: null,
  },
  payment: { paid: true, paymentId: "p1", method: "WALLET", at: null, amountInCents: 18100, byBatch: true, batchId: "b1", pixFeeWaivedInCents: 85 },
  job: null,
  arrival: null,
  attendance: null,
  ...over,
});

describe("lot-lines-api", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lê as linhas da rota certa e valida cada bloco", async () => {
    get.mockResolvedValue({ data: { data: { lotId: "l1", serviceDate: "2026-11-14", lines: [line()] } } });
    const out = await getAdminLotLines("l1");
    expect(get).toHaveBeenCalledWith("/lots/l1/lines");
    expect(out.lines[0].payment?.byBatch).toBe(true);
    expect(out.lines[0].payment?.pixFeeWaivedInCents).toBe(85);
    expect(out.lines[0].ask?.state).toBe("YES");
  });

  it("vaga livre e blocos ausentes viram null; estado novo da API passa como texto", async () => {
    get.mockResolvedValue({
      data: { data: { lotId: "l1", serviceDate: "2026-11-14", lines: [line({ chosen: null, ask: undefined, payment: undefined, attendance: { status: "NOVO" } })] } },
    });
    const out = await getAdminLotLines("l1");
    expect(out.lines[0].chosen).toBeNull();
    expect(out.lines[0].ask).toBeNull();
    expect(out.lines[0].payment).toBeNull();
    expect(out.lines[0].attendance?.status).toBe("NOVO");
  });

  it("resposta fora do formato lança (a seção mostra o erro, não quebra a página)", async () => {
    get.mockResolvedValue({ data: { data: { lines: "x" } } });
    await expect(getAdminLotLines("l1")).rejects.toThrow();
  });
});

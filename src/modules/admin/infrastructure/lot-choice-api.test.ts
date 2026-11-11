import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, post }),
}));

import { chooseAdminLot, getAdminLotCandidates } from "./lot-choice-api";

describe("lot-choice-api", () => {
  beforeEach(() => vi.clearAllMocks());

  it("candidatos: rota do admin, com a chave da função, e leitura tolerante", async () => {
    get.mockResolvedValue({
      data: {
        data: {
          lotId: "l1",
          groupKey: "k1",
          serviceDate: "2026-11-14",
          title: "Garçom",
          billing: "PREPAID",
          vacancies: 12,
          free: 7,
          choiceMax: 20,
          askPlan: { askAt: "2026-11-14T17:02:00.000Z", answerMinutes: 60, delaySeconds: 120 },
          chosen: [{ candidacyId: "c1", vacancyId: "v1", providerGlobalId: "g1", name: "Ana", paid: false, confirmedAt: null, ask: null }],
          candidates: [
            { id: "c2", vacancyId: "v2", provider: { providerGlobalId: "g2", name: "João", averageRating: 4.5, completedServices: 3 }, choosable: true, lastAskOutcome: "NO_ANSWER", campoNovo: 1 },
          ],
          total: 1,
        },
      },
    });
    const out = await getAdminLotCandidates("l1", "k1");
    expect(get).toHaveBeenCalledWith("/lots/l1/groups/k1/candidates");
    expect(out.choiceMax).toBe(20);
    expect(out.askPlan?.answerMinutes).toBe(60);
    expect(out.candidates[0].provider.providerGlobalId).toBe("g2");
    expect(out.candidates[0].busy).toBe(false);
    expect(out.chosen[0].ask).toBeNull();
  });

  it("sem askPlan (chave desligada) fica null", async () => {
    get.mockResolvedValue({ data: { data: { lotId: "l1", groupKey: "k1" } } });
    const out = await getAdminLotCandidates("l1", "k1");
    expect(out.askPlan).toBeNull();
    expect(out.candidates).toEqual([]);
  });

  it("escolher: envia só groupKey e providerGlobalIds, na ordem; lê o resultado por item", async () => {
    post.mockResolvedValue({
      data: {
        data: {
          summary: { requested: 2, accepted: 1, alreadyChosen: 0, failed: 1, billing: "PREPAID", chosenAmountInCents: 18100, dayUnpaidCount: 1, dayUnpaidInCents: 18100, asksScheduled: 1 },
          items: [
            { providerGlobalId: "g1", status: "ACCEPTED", vacancyId: "v1", candidacyId: "c1", vacancyPaid: false, message: "Escolha feita. Falta pagar.", ask: { state: "SCHEDULED", askAt: "2026-11-14T17:02:00.000Z" } },
            { providerGlobalId: "g2", status: "SCHEDULE_CONFLICT", vacancyId: null, candidacyId: null, vacancyPaid: false, message: "Acabou de aceitar outro serviço nesse horário." },
          ],
        },
      },
    });
    const out = await chooseAdminLot("l1", { groupKey: "k1", providerGlobalIds: ["g1", "g2"] });
    expect(post).toHaveBeenCalledWith("/lots/l1/choices", { groupKey: "k1", providerGlobalIds: ["g1", "g2"] });
    expect(out.items[0].ask?.state).toBe("SCHEDULED");
    expect(out.items[1].ask).toBeNull();
    expect(out.items[1].message).toContain("outro serviço");
    expect(out.summary.asksScheduled).toBe(1);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, post }),
}));

import {
  advancedBreakdownOf,
  getVacancyRepasse,
  markRepassePaidExternally,
  vacancyRepasseOf,
} from "./held-repasses-api";

/** "Pago por fora" (23/11/2026): contrato da API `POST .../mark-paid-externally` e `GET .../by-vacancy/:id`. */
beforeEach(() => vi.clearAllMocks());

const SLICE = { count: 1, valueInCents: 9500 };

describe("markRepassePaidExternally", () => {
  it("rota com o id, motivo sem espaços nas pontas, dia, valor e comprovante; resposta lida", async () => {
    post.mockResolvedValue({
      data: {
        data: {
          repasseId: "rep-1",
          vacancyId: "vac-1",
          status: "COMPLETED",
          amountInCents: 12000,
          paidExternally: {
            at: "2026-11-23T15:00:00.000Z",
            adminId: "adm-diego",
            reason: "Empresa vai atrasar a fatura",
            amountPaidInCents: 10000,
            proof: "E2E123",
          },
          differenceInCents: -2000,
          pendingBonusInCents: 1500,
          alreadyMarked: false,
        },
      },
    });

    const result = await markRepassePaidExternally("rep/1", {
      reason: "  Empresa vai atrasar a fatura  ",
      paidAt: "2026-11-23",
      amountPaidInCents: 10000,
      proof: "  E2E123 ",
    });

    expect(post).toHaveBeenCalledWith("/repasses/rep%2F1/mark-paid-externally", {
      reason: "Empresa vai atrasar a fatura",
      paidAt: "2026-11-23",
      amountPaidInCents: 10000,
      proof: "E2E123",
    });
    expect(result).toEqual({
      repasseId: "rep-1",
      vacancyId: "vac-1",
      amountInCents: 12000,
      paidExternally: {
        at: "2026-11-23T15:00:00.000Z",
        amountPaidInCents: 10000,
        reason: "Empresa vai atrasar a fatura",
        proof: "E2E123",
        adminId: "adm-diego",
      },
      differenceInCents: -2000,
      pendingBonusInCents: 1500,
      alreadyMarked: false,
    });
  });

  it("comprovante vazio não vai no corpo", async () => {
    post.mockResolvedValue({ data: { data: {} } });

    await markRepassePaidExternally("rep-1", {
      reason: "Pix da Freela falhou",
      paidAt: "2026-11-23",
      amountPaidInCents: 12000,
      proof: "   ",
    });

    expect(post.mock.calls[0][1]).not.toHaveProperty("proof");
  });
});

describe("getVacancyRepasse / vacancyRepasseOf", () => {
  it("rota por vaga; lê situação, retenção, bloco do pago por fora e se pode marcar", async () => {
    get.mockResolvedValue({
      data: {
        data: {
          repasseId: "rep-1",
          vacancyId: "vac-1",
          status: "AWAITING_INVOICE",
          amountInCents: 12000,
          failureReason: null,
          withdrawalStatus: null,
          releaseAuthorized: false,
          expectedDate: "2026-11-24",
          deadlineAt: "2026-11-28T03:00:00.000Z",
          paidExternally: null,
          markPaidExternally: { allowed: true, blockedCode: null, blockedMessage: null },
        },
      },
    });

    const repasse = await getVacancyRepasse("vac-1");

    expect(get).toHaveBeenCalledWith("/repasses/by-vacancy/vac-1");
    expect(repasse).toEqual(
      expect.objectContaining({
        repasseId: "rep-1",
        status: "AWAITING_INVOICE",
        expectedDate: "2026-11-24",
        markPaidExternally: { allowed: true, blockedMessage: null },
      }),
    );
  });

  it("sem repasse (data null) ou resposta quebrada → null; sem o bloco de marcar → não pode", () => {
    expect(vacancyRepasseOf(null)).toBeNull();
    expect(vacancyRepasseOf({ status: "FAILED" })).toBeNull();
    expect(
      vacancyRepasseOf({ repasseId: "r", status: "COMPLETED", amountInCents: 1 })?.markPaidExternally.allowed,
    ).toBe(false);
  });
});

describe("advancedBreakdownOf com o pago por fora", () => {
  it("lê a quinta fatia quando vem; ausente (API de antes) = zero", () => {
    const base = { onCompletion: SLICE, deadline: SLICE, admin: SLICE, invoiceCancelled: SLICE };
    expect(advancedBreakdownOf({ ...base, paidExternally: { count: 2, valueInCents: 24000 } })?.paidExternally).toEqual({
      count: 2,
      valueInCents: 24000,
    });
    expect(advancedBreakdownOf(base)?.paidExternally).toEqual({ count: 0, valueInCents: 0 });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, post }),
}));

import {
  getCommissionStatement,
  previewCommissionPayout,
  registerCommissionPayout,
  reverseCommissionPayout,
} from "./consultant-commissions-api";

describe("consultant-commissions-api", () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { data: { ok: true } } });
    post.mockReset().mockResolvedValue({ data: { data: { ok: true } } });
  });

  it("extrato e prévia mandam filtros como query e desembrulham { data }", async () => {
    await expect(getCommissionStatement("c 1", { from: "2026-10-01", status: "OPEN" })).resolves.toEqual({ ok: true });
    expect(get).toHaveBeenCalledWith("/consultants/c%201/commission-statement", {
      params: { from: "2026-10-01", status: "OPEN" },
    });
    await previewCommissionPayout("c1", "2026-10-05");
    expect(get).toHaveBeenLastCalledWith("/consultants/c1/commission-payouts/preview", {
      params: { periodEnd: "2026-10-05" },
    });
  });

  it("pagamento e estorno vão para as rotas do consultor", async () => {
    const payload = { periodEnd: "2026-10-05", paidAt: "2026-10-06", paymentProof: "E1", expectedAmountInCents: 315 };
    await registerCommissionPayout("c1", payload);
    expect(post).toHaveBeenCalledWith("/consultants/c1/commission-payouts", payload);
    await reverseCommissionPayout("c1", "p/1", "motivo");
    expect(post).toHaveBeenLastCalledWith("/consultants/c1/commission-payouts/p%2F1/reverse", { reason: "motivo" });
  });
});

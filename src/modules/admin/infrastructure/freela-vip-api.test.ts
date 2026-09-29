import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() }),
}));

import { resendVipInvites } from "./freela-vip-api";

describe("resendVipInvites", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("manda os ids e devolve o resultado", async () => {
    post.mockResolvedValueOnce({
      data: { data: { resent: [{ applicationId: "a1", whatsapp: "SENT" }], skipped: [] } },
    });
    await expect(resendVipInvites("c1", ["a1"])).resolves.toEqual({
      resent: [{ applicationId: "a1", whatsapp: "SENT" }],
      skipped: [],
    });
    expect(post).toHaveBeenCalledWith("/cycles/c1/invites/resend", { applicationIds: ["a1"] });
  });

  it("quebra em lotes de 10 (cabe no timeout de 30 s) e junta os resultados", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `a${i}`);
    post.mockImplementation(async (...args: unknown[]) => {
      const body = args[1] as { applicationIds: string[] };
      return {
        data: {
          data: {
            resent: body.applicationIds.map((applicationId) => ({ applicationId, whatsapp: "SENT" })),
            skipped: [],
          },
        },
      };
    });
    const out = await resendVipInvites("c1", ids);
    expect(post).toHaveBeenCalledTimes(12);
    expect(post.mock.calls.every((c) => c[1].applicationIds.length === 10)).toBe(true);
    expect(out.resent).toHaveLength(120);
  });

  it("lote que falha depois de outros deu certo: devolve o parcial e marca o resto como não enviado", async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `a${i}`);
    let call = 0;
    post.mockImplementation(async (...args: unknown[]) => {
      call += 1;
      if (call === 2) throw new Error("timeout");
      const body = args[1] as { applicationIds: string[] };
      return { data: { data: { resent: body.applicationIds.map((applicationId) => ({ applicationId, whatsapp: "SENT" })), skipped: [] } } };
    });
    const out = await resendVipInvites("c1", ids);
    expect(out.resent).toHaveLength(10);
    expect(out.skipped).toHaveLength(15);
    expect(out.skipped.every((s) => s.reason === "REQUEST_FAILED")).toBe(true);
  });

  it("primeiro lote falha: propaga o erro (nada foi enviado)", async () => {
    post.mockRejectedValue(new Error("offline"));
    await expect(resendVipInvites("c1", ["a1"])).rejects.toThrow("offline");
  });
});

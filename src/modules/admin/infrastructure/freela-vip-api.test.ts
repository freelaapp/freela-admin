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

  it("quebra em lotes de 50 (limite da API) e junta os resultados", async () => {
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
    expect(post).toHaveBeenCalledTimes(3);
    expect(post.mock.calls.map((c) => c[1].applicationIds.length)).toEqual([50, 50, 20]);
    expect(out.resent).toHaveLength(120);
  });
});

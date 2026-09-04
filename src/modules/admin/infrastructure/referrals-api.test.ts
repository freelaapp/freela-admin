import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock do client autenticado — mesmo padrão usado em campaign-templates-api.test.ts
// (vi.hoisted evita o hoisting trap do vi.mock com closures externas).
const { post } = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ post }),
}));

import {
  createCampaign,
  getCampaignCounts,
  readAlreadyRegistered,
  type CampaignDetail,
  type CreateCampaignPayload,
  type ExternalListPreview,
} from "./referrals-api";

const basePreview: ExternalListPreview = {
  valid: 3,
  invalid: [],
  duplicates: 0,
  alreadyRegistered: 2,
  byChannel: { whatsapp: 2, email: 1 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createCampaign", () => {
  it("faz POST /activation-campaigns com devzappFunnelUrl e sem ritmo/variantes", async () => {
    const payload: CreateCampaignPayload = {
      name: "Reativação contratantes",
      audience: "CONTRACTORS_NEVER_PUBLISHED",
      devzappFunnelUrl: "https://api.devzapp.com.br/funil/start/v2/execute/abc",
    };
    const created = { campaign: { id: "camp-1" } } as unknown as CampaignDetail;
    post.mockResolvedValue({ data: { data: created } });

    const result = await createCampaign(payload);

    expect(post).toHaveBeenCalledWith("/activation-campaigns", payload);
    // A DevZapp é dona do ritmo/variantes agora — o payload não carrega mais
    // esses campos (o backend ignoraria/defaultaria de qualquer forma).
    expect(payload).not.toHaveProperty("whatsappTemplate");
    expect(payload).not.toHaveProperty("messagesPerHour");
    expect(payload).not.toHaveProperty("dailyCap");
    expect(payload).not.toHaveProperty("windowStartHour");
    expect(payload).not.toHaveProperty("windowEndHour");
    expect(payload).not.toHaveProperty("weekdaysOnly");
    expect(result).toEqual(created);
  });
});

describe("readAlreadyRegistered", () => {
  it("devolve as linhas quando a API manda alreadyRegisteredRows", () => {
    const rows = [
      { row: 1, userId: "u1", role: "provider" as const },
      { row: 4, userId: "u2", role: "contractor" as const },
    ];
    expect(readAlreadyRegistered({ ...basePreview, alreadyRegisteredRows: rows })).toEqual({
      count: 2,
      rows,
    });
  });

  it("API antiga (só contagem): rows é null, contagem preservada", () => {
    expect(readAlreadyRegistered(basePreview)).toEqual({ count: 2, rows: null });
  });
});

describe("getCampaignCounts", () => {
  const detail = {
    stats: { PENDING: 3, SENT: 1, FAILED: 1, SKIPPED: 0 },
    total: 5,
  } as unknown as CampaignDetail;

  it("usa counts quando a API manda", () => {
    expect(
      getCampaignCounts({
        ...detail,
        counts: { total: 5, sent: 1, failed: 1, pending: 3, contacted: 2, registered: 2, registeredAfterCampaign: 1 },
      }),
    ).toEqual({ total: 5, sent: 1, failed: 1, pending: 3, contacted: 2, registered: 2, registeredAfterCampaign: 1 });
  });

  it("compõe a partir de stats na API antiga", () => {
    expect(getCampaignCounts(detail)).toEqual({
      total: 5,
      sent: 1,
      failed: 1,
      pending: 3,
      contacted: 0,
      registered: 0,
      registeredAfterCampaign: undefined,
    });
  });
});

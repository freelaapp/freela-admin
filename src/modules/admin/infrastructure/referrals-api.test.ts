import { describe, expect, it } from "vitest";
import {
  getCampaignCounts,
  readAlreadyRegistered,
  type CampaignDetail,
  type ExternalListPreview,
} from "./referrals-api";

const basePreview: ExternalListPreview = {
  valid: 3,
  invalid: [],
  duplicates: 0,
  alreadyRegistered: 2,
  byChannel: { whatsapp: 2, email: 1 },
};

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

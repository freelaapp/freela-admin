import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock do client autenticado — mesmo padrão usado em campaign-templates-api.test.ts
// (vi.hoisted evita o hoisting trap do vi.mock com closures externas).
const { get, post, patch } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, post, patch }),
}));

import {
  createCampaign,
  getCampaignCounts,
  getCampaignResults,
  getCampaignEstimate,
  previewCampaignAudience,
  readAlreadyRegistered,
  scheduleCampaign,
  unscheduleCampaign,
  updateCampaign,
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
  it("faz POST /activation-campaigns com o modelo da biblioteca; sem funil externo nem texto livre", async () => {
    const payload: CreateCampaignPayload = {
      name: "Reativação contratantes",
      audience: "CONTRACTORS_NEVER_PUBLISHED",
      marketingTemplateId: "tpl-1",
    };
    const created = { campaign: { id: "camp-1" } } as unknown as CampaignDetail;
    post.mockResolvedValue({ data: { data: created } });

    const result = await createCampaign(payload);

    expect(post).toHaveBeenCalledWith("/activation-campaigns", payload);
    expect(payload).not.toHaveProperty("devzappFunnelUrl");
    expect(payload).not.toHaveProperty("whatsappTemplate");
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

describe("campanha avulsa pela Meta (spec 2026-10-01 parte 1 §6)", () => {
  const detail = { campaign: { id: "camp-1", status: "SCHEDULED" } } as unknown as CampaignDetail;

  it("agenda com o instante ISO com fuso e desagenda", async () => {
    patch.mockResolvedValue({ data: { data: detail } });

    expect(await scheduleCampaign("camp-1", "2026-10-02T10:00:00-03:00")).toEqual(detail);
    expect(patch).toHaveBeenLastCalledWith("/activation-campaigns/camp-1/schedule", {
      startAt: "2026-10-02T10:00:00-03:00",
    });

    await unscheduleCampaign("camp-1");
    expect(patch).toHaveBeenLastCalledWith("/activation-campaigns/camp-1/unschedule");
  });

  it("edita o rascunho (modelo, resposta, ritmo)", async () => {
    patch.mockResolvedValue({ data: { data: detail } });
    const payload = { marketingTemplateId: "tpl-1", replyText: null, messagesPerHour: 30 };

    await updateCampaign("camp-1", payload);

    expect(patch).toHaveBeenCalledWith("/activation-campaigns/camp-1", payload);
  });

  it("lê o resumo do passo 4", async () => {
    const estimate = {
      recipients: { whatsapp: 425, email: 30, total: 455 },
      excludedByOptOut: 7,
      whatsappToSend: 418,
      pricePerMessageBrl: 0.35,
      estimatedCostBrl: 146.3,
      estimate: { perDay: 200, days: 3 },
    };
    get.mockResolvedValue({ data: { data: estimate } });

    expect(await getCampaignEstimate("camp-1")).toEqual(estimate);
    expect(get).toHaveBeenCalledWith("/activation-campaigns/camp-1/estimate");
  });

  it("conta 'todos os contratantes' e devolve os excluídos por saída", async () => {
    const counted = {
      total: 425,
      byChannel: { WHATSAPP: 418, EMAIL: 7 },
      semCoordenada: 0,
      excludedByOptOut: 12,
    };
    post.mockResolvedValue({ data: { data: counted } });

    expect(await previewCampaignAudience({ audience: "CONTRACTORS_ALL" })).toEqual(counted);
    expect(post).toHaveBeenCalledWith("/activation-campaigns/audience-preview", {
      audience: "CONTRACTORS_ALL",
    });
  });

  it("cria com o modelo da biblioteca, a resposta e o ritmo", async () => {
    const payload: CreateCampaignPayload = {
      name: "Apresentação Freela — Rebeca",
      audience: "CONTRACTORS_ALL",
      marketingTemplateId: "tpl-1",
      replyText: "Obrigado! A Rebeca vai falar com você.",
      replyAlertEmail: "rebeca@freelaservicos.com.br",
      messagesPerHour: 60,
      dailyCap: 200,
    };
    post.mockResolvedValue({ data: { data: detail } });

    await createCampaign(payload);

    expect(post).toHaveBeenCalledWith("/activation-campaigns", payload);
  });
});

describe("campanhas pela Meta, parte 2 (spec 2026-10-01 parte 2)", () => {
  it("resultados: GET /activation-campaigns/:id/results", async () => {
    const results = {
      recipients: 200,
      sent: 190,
      delivered: 180,
      read: 120,
      clicked: 30,
      clicks: 41,
      optedOut: 2,
      replied: 5,
      billable: 180,
      costBrl: 63,
      signups: 3,
      publishedVacancy: 4,
      hired: 1,
      rates: { deliveredRate: 0.9474, readRate: 0.6667, clickRate: 0.1667 },
      notReceived: [{ reason: "Pediu para não receber campanhas.", count: 10 }],
      clickTracking: true,
      pricePerMessageBrl: 0.35,
    };
    get.mockResolvedValue({ data: { data: results } });
    expect(await getCampaignResults("camp-1")).toEqual(results);
    expect(get).toHaveBeenCalledWith("/activation-campaigns/camp-1/results");
  });

  it("prévia com os filtros novos devolve os excluídos por motivo", async () => {
    const counted = {
      total: 380,
      byChannel: { WHATSAPP: 373, EMAIL: 7 },
      semCoordenada: 0,
      excludedByOptOut: 12,
      excluded: { noVacancy: 30, hired: 5, recentlyContacted: 10, optedOut: 12 },
    };
    post.mockResolvedValue({ data: { data: counted } });
    const filters = { noVacancyForDays: 30, excludeHired: true, excludeContactedWithinDays: 7 };
    expect(await previewCampaignAudience({ audience: "CONTRACTORS_ALL", filters })).toEqual(counted);
    expect(post).toHaveBeenCalledWith("/activation-campaigns/audience-preview", {
      audience: "CONTRACTORS_ALL",
      filters,
    });
  });
});

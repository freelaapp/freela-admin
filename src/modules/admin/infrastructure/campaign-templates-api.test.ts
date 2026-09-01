import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock do client autenticado — mesmo padrão usado em contractor-report-pdf.test.ts
// (vi.hoisted evita o hoisting trap do vi.mock com closures externas).
const { get, post, patch, put } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, post, patch, put }),
}));

import {
  createCampaignTemplate,
  getCampaignTemplate,
  listCampaignTemplates,
  setCampaignTemplateEnabled,
  updateCampaignTemplate,
  uploadCampaignTemplateImage,
  type CampaignTemplate,
  type UpsertCampaignTemplatePayload,
} from "./campaign-templates-api";

const template: CampaignTemplate = {
  id: "tpl-1",
  name: "Reengajamento semanal",
  scheduleKind: "WEEKLY",
  weekdays: [1, 3, 5],
  sendHour: 9,
  leadDays: 0,
  audience: "CONTRACTORS_ALL",
  channels: ["PUSH"],
  enabled: true,
  lastRunFor: null,
  lastRunAt: null,
  createdAt: "2026-08-31T00:00:00.000Z",
};

const payload: UpsertCampaignTemplatePayload = {
  name: "Reengajamento semanal",
  scheduleKind: "WEEKLY",
  weekdays: [1, 3, 5],
  sendHour: 9,
  leadDays: 0,
  audience: "CONTRACTORS_ALL",
  channels: ["PUSH"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listCampaignTemplates", () => {
  it("faz GET /campaign-templates e devolve res.data.data", async () => {
    get.mockResolvedValue({ data: { data: [template] } });

    const result = await listCampaignTemplates();

    expect(get).toHaveBeenCalledWith("/campaign-templates");
    expect(result).toEqual([template]);
  });
});

describe("getCampaignTemplate", () => {
  it("faz GET /campaign-templates/:id e devolve res.data.data", async () => {
    get.mockResolvedValue({ data: { data: template } });

    const result = await getCampaignTemplate("tpl-1");

    expect(get).toHaveBeenCalledWith("/campaign-templates/tpl-1");
    expect(result).toEqual(template);
  });
});

describe("createCampaignTemplate", () => {
  it("faz POST /campaign-templates com o payload e devolve res.data.data", async () => {
    post.mockResolvedValue({ data: { data: template } });

    const result = await createCampaignTemplate(payload);

    expect(post).toHaveBeenCalledWith("/campaign-templates", payload);
    expect(result).toEqual(template);
  });
});

describe("updateCampaignTemplate", () => {
  it("faz PUT /campaign-templates/:id com o payload e devolve res.data.data", async () => {
    put.mockResolvedValue({ data: { data: template } });

    const result = await updateCampaignTemplate("tpl-1", payload);

    expect(put).toHaveBeenCalledWith("/campaign-templates/tpl-1", payload);
    expect(result).toEqual(template);
  });
});

describe("setCampaignTemplateEnabled", () => {
  it("faz PATCH /campaign-templates/:id/enabled com { enabled: true }", async () => {
    patch.mockResolvedValue({ data: { data: { ...template, enabled: true } } });

    const result = await setCampaignTemplateEnabled("tpl-1", true);

    expect(patch).toHaveBeenCalledWith("/campaign-templates/tpl-1/enabled", { enabled: true });
    expect(result).toEqual({ ...template, enabled: true });
  });

  it("faz PATCH /campaign-templates/:id/enabled com { enabled: false }", async () => {
    patch.mockResolvedValue({ data: { data: { ...template, enabled: false } } });

    const result = await setCampaignTemplateEnabled("tpl-1", false);

    expect(patch).toHaveBeenCalledWith("/campaign-templates/tpl-1/enabled", { enabled: false });
    expect(result).toEqual({ ...template, enabled: false });
  });
});

describe("uploadCampaignTemplateImage", () => {
  it("faz POST /campaign-templates/upload multipart e devolve { key, url }", async () => {
    const upload = { key: "campaign-templates/abc.png", url: "https://s3/abc.png" };
    post.mockResolvedValue({ data: { data: upload } });
    const file = new File(["conteudo"], "banner.png", { type: "image/png" });

    const result = await uploadCampaignTemplateImage(file);

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe("/campaign-templates/upload");
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("file")).toBe(file);
    expect(config).toEqual({ headers: { "Content-Type": "multipart/form-data" } });
    expect(result).toEqual(upload);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mesmo padrão de campaign-templates-api.test.ts (vi.hoisted evita o hoisting trap do vi.mock).
const { get, post, put, patch } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, post, put, patch }),
}));

import {
  archiveMarketingTemplate,
  createMarketingTemplate,
  getMarketingTemplate,
  listMarketingTemplates,
  newMarketingTemplateVersion,
  sendMarketingTemplateTest,
  submitMarketingTemplate,
  updateMarketingTemplate,
  type MarketingTemplateInput,
  type MarketingTemplateView,
} from "./marketing-templates-api";

const view: MarketingTemplateView = {
  id: "tpl-1",
  name: "Apresentação Freela — Rebeca",
  metaName: "mkt_apresentacao_freela_rebeca_v1",
  version: 1,
  previousVersionId: null,
  body: "Oi, {primeiro_nome}! Tudo bem?",
  paramOrder: ["primeiro_nome"],
  imageKey: null,
  imageUrl: null,
  buttons: [{ type: "URL", text: "Cadastrar meu negócio", url: "https://www.freelaservicos.com.br" }],
  status: "DRAFT",
  metaTemplateId: null,
  metaCategory: null,
  categoryWarning: false,
  rejectedReason: null,
  submittedAt: null,
  approvedAt: null,
  statusCheckedAt: null,
  createdByAdminId: "admin-1",
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
  ruleErrors: [],
  usage: { campaigns: 0, automatic: 0 },
};

const input: MarketingTemplateInput = {
  name: view.name,
  body: view.body,
  imageKey: null,
  buttons: [{ type: "URL", text: "Cadastrar meu negócio", url: "https://www.freelaservicos.com.br" }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("biblioteca de modelos de marketing", () => {
  it("lista sem filtro (a API tira os arquivados) e com filtro de situação", async () => {
    get.mockResolvedValue({ data: { data: [view] } });

    expect(await listMarketingTemplates()).toEqual([view]);
    expect(get).toHaveBeenLastCalledWith("/marketing-templates");

    await listMarketingTemplates("APPROVED");
    expect(get).toHaveBeenLastCalledWith("/marketing-templates", { params: { status: "APPROVED" } });
  });

  it("busca um modelo", async () => {
    get.mockResolvedValue({ data: { data: view } });
    expect(await getMarketingTemplate("tpl-1")).toEqual(view);
    expect(get).toHaveBeenCalledWith("/marketing-templates/tpl-1");
  });

  it("cria e edita com o corpo da tela", async () => {
    post.mockResolvedValue({ data: { data: view } });
    put.mockResolvedValue({ data: { data: view } });

    expect(await createMarketingTemplate(input)).toEqual(view);
    expect(post).toHaveBeenCalledWith("/marketing-templates", input);

    expect(await updateMarketingTemplate("tpl-1", input)).toEqual(view);
    expect(put).toHaveBeenCalledWith("/marketing-templates/tpl-1", input);
  });

  it("nova versão, arquivar e enviar para aprovação", async () => {
    post.mockResolvedValue({ data: { data: { ...view, id: "tpl-2", version: 2 } } });
    patch.mockResolvedValue({ data: { data: { ...view, status: "ARCHIVED" } } });

    expect((await newMarketingTemplateVersion("tpl-1")).version).toBe(2);
    expect(post).toHaveBeenLastCalledWith("/marketing-templates/tpl-1/version");

    expect((await archiveMarketingTemplate("tpl-1")).status).toBe("ARCHIVED");
    expect(patch).toHaveBeenCalledWith("/marketing-templates/tpl-1/archive");

    await submitMarketingTemplate("tpl-1");
    expect(post).toHaveBeenLastCalledWith("/marketing-templates/tpl-1/submit");
  });

  it("teste: sem telefone vai para o celular do admin; com campanha manda o id", async () => {
    post.mockResolvedValue({ data: { data: { status: "sent", wamid: "wamid.1" } } });

    expect(await sendMarketingTemplateTest("tpl-1")).toEqual({ status: "sent", wamid: "wamid.1" });
    expect(post).toHaveBeenLastCalledWith("/marketing-templates/tpl-1/test", {});

    await sendMarketingTemplateTest("tpl-1", { campaignId: "camp-1" });
    expect(post).toHaveBeenLastCalledWith("/marketing-templates/tpl-1/test", { campaignId: "camp-1" });
  });
});

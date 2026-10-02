import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignTemplate } from "@/modules/admin/infrastructure/campaign-templates-api";
import type { MarketingTemplateView } from "@/modules/admin/infrastructure/marketing-templates-api";
import CampanhasAutomaticasPage from "../page";

vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ allowed: true, isChecking: false }),
}));
vi.mock("@/modules/auth/application/use-auth", () => ({
  useAuth: () => ({ user: { email: "rebeca@freelaservicos.com.br" } }),
}));
const api = vi.hoisted(() => ({
  listCampaignTemplates: vi.fn(),
  setCampaignTemplateEnabled: vi.fn(),
  updateCampaignTemplate: vi.fn(),
  listCampaignTemplateRuns: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/campaign-templates-api", async (orig) => ({
  ...(await orig<object>()),
  ...api,
}));
const mkt = vi.hoisted(() => ({ listMarketingTemplates: vi.fn() }));
vi.mock("@/modules/admin/infrastructure/marketing-templates-api", async (orig) => ({
  ...(await orig<object>()),
  ...mkt,
}));
const ref = vi.hoisted(() => ({
  getAudienceOptions: vi.fn(),
  previewCampaignAudience: vi.fn(),
  getCampaign: vi.fn(),
  getCampaignRecipients: vi.fn(),
  getCampaignResults: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/referrals-api", async (orig) => ({
  ...(await orig<object>()),
  ...ref,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const sextou: CampaignTemplate = {
  id: "t-sextou",
  name: "campanha Sextou",
  scheduleKind: "WEEKLY",
  weekdays: [5],
  sendHour: 10,
  audience: "CONTRACTORS_ALL",
  channels: ["WHATSAPP", "PUSH"],
  pushTitle: "Sextou!",
  pushBody: "Bora?",
  enabled: true,
  lastRunFor: null,
  lastRunAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  marketingTemplateId: null,
  marketingTemplate: null,
  whatsappNeedsTemplate: true,
  whatsappNotice: "Escolha um modelo aprovado para voltar a mandar WhatsApp",
};

const sextouPush: CampaignTemplate = {
  ...sextou,
  id: "t-sextou-push",
  name: "Sextou",
  channels: ["PUSH"],
  whatsappNeedsTemplate: false,
  whatsappNotice: null,
};

const reativacao: CampaignTemplate = {
  ...sextou,
  id: "t-reativacao",
  name: "Reativação",
  enabled: false,
  channels: ["WHATSAPP"],
  marketingTemplateId: "mkt-1",
  marketingTemplate: { id: "mkt-1", name: "Publique sua primeira vaga", status: "APPROVED", metaName: "mkt_publique_v1" },
  whatsappNeedsTemplate: false,
  whatsappNotice: null,
};

const approved = (over: Partial<MarketingTemplateView> = {}): MarketingTemplateView => ({
  id: "mkt-1",
  name: "Publique sua primeira vaga",
  metaName: "mkt_publique_v1",
  version: 1,
  previousVersionId: null,
  body: "Oi, {primeiro_nome}! Bora publicar?",
  paramOrder: ["primeiro_nome"],
  imageKey: null,
  imageUrl: null,
  buttons: [],
  status: "APPROVED",
  metaTemplateId: "1",
  metaCategory: "MARKETING",
  categoryWarning: false,
  rejectedReason: null,
  submittedAt: null,
  approvedAt: null,
  statusCheckedAt: null,
  createdByAdminId: "admin-1",
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
  ruleErrors: [],
  usage: { campaigns: 0, automatic: 1 },
  ...over,
});

function apiError(message: string) {
  const err = new AxiosError("fail");
  err.response = { data: { error: { code: "MARKETING_TEMPLATE_NOT_APPROVED", message } } } as AxiosError["response"];
  return err;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CampanhasAutomaticasPage />
    </QueryClientProvider>,
  );
}

describe("CampanhasAutomaticasPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listCampaignTemplates.mockResolvedValue({
      data: [sextou, reativacao],
      meta: { schedulerEnabled: true, templatesSchedulerEnabled: true },
    });
    mkt.listMarketingTemplates.mockResolvedValue([approved()]);
    ref.getAudienceOptions.mockResolvedValue({ total: 0, cities: [] });
    ref.previewCampaignAudience.mockResolvedValue({ total: 10, byChannel: { WHATSAPP: 10, EMAIL: 0 }, excludedByOptOut: 0 });
  });

  it("automática sem modelo aprovado: aviso na linha; sem DevZapp na tela", async () => {
    renderPage();
    expect(
      (await screen.findAllByText("Escolha um modelo aprovado para voltar a mandar WhatsApp")).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Sem modelo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Publique sua primeira vaga").length).toBeGreaterThan(0);
    expect(screen.queryByText(/O agendador está/)).not.toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(/devzapp/i);
  });

  it("agendador da automática desligado: aviso no topo", async () => {
    api.listCampaignTemplates.mockResolvedValue({
      data: [reativacao],
      meta: { schedulerEnabled: true, templatesSchedulerEnabled: false },
    });
    renderPage();
    expect(await screen.findByText(/O agendador está/)).toHaveTextContent(
      "O agendador está desligado (CAMPAIGN_TEMPLATES_ENABLED ou ACTIVATION_CAMPAIGNS_ENABLED não está como true em produção).",
    );
  });

  it("Editar abre os 4 passos com a automática preenchida", async () => {
    renderPage();
    fireEvent.click((await screen.findAllByRole("button", { name: "Editar" }))[0]);
    expect(await screen.findByRole("heading", { name: "Editar campanha automática" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da campanha")).toHaveValue("campanha Sextou");
    expect(document.body.textContent ?? "").not.toMatch(/devzapp/i);
  });

  it("Ligar recusado pela API mostra o motivo", async () => {
    api.setCampaignTemplateEnabled.mockRejectedValue(
      apiError("O modelo precisa estar aprovado pela Meta. Situação atual: pausado pela Meta."),
    );
    renderPage();
    fireEvent.click((await screen.findAllByRole("button", { name: "Ligar" }))[0]);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "O modelo precisa estar aprovado pela Meta. Situação atual: pausado pela Meta.",
      ),
    );
    expect(api.setCampaignTemplateEnabled).toHaveBeenCalledWith("t-reativacao", true);
  });

  it("aba Modelos: 'Usar' abre a nova automática", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Modelos" }));
    fireEvent.click(await screen.findByRole("button", { name: "Usar" }));
    expect(await screen.findByRole("heading", { name: "Nova campanha automática" })).toBeInTheDocument();
  });

  it("celular: cabeçalho em coluna e alvos de 44 px", async () => {
    renderPage();
    await screen.findAllByText("Reativação");
    const header = screen.getByRole("heading", { name: "Campanhas automáticas" }).parentElement?.parentElement;
    expect(header).toHaveClass("flex-col", "sm:flex-row");
    expect(screen.getByRole("button", { name: "Nova campanha automática" })).toHaveClass("min-h-11");
    for (const button of screen.getAllByRole("button", { name: "Editar" })) {
      expect(button).toHaveClass("min-h-11");
    }
  });

  const rowOf = (name: string) => screen.getAllByText(name)[0].closest("tr") as HTMLElement;
  const continuar = () => screen.getByRole("button", { name: "Continuar" });

  describe("automações que já rodam em produção", () => {
    beforeEach(() => {
      api.listCampaignTemplates.mockResolvedValue({
        data: [sextou, sextouPush],
        meta: { schedulerEnabled: true, templatesSchedulerEnabled: true },
      });
      api.updateCampaignTemplate.mockImplementation(async (id: string) => ({ ...sextou, id }));
      api.setCampaignTemplateEnabled.mockResolvedValue(sextou);
    });

    it("'campanha Sextou' (WhatsApp+push, sem modelo): aviso só nela; 'Sextou' (só push) sem aviso nem modelo", async () => {
      renderPage();
      await screen.findAllByText("campanha Sextou");
      expect(within(rowOf("campanha Sextou")).getByText("Escolha um modelo aprovado para voltar a mandar WhatsApp")).toBeInTheDocument();
      expect(within(rowOf("campanha Sextou")).getByText("Sem modelo")).toBeInTheDocument();
      const push = rowOf("Sextou");
      expect(within(push).queryByText(/Escolha um modelo aprovado/)).not.toBeInTheDocument();
      expect(within(push).queryByText("Sem modelo")).not.toBeInTheDocument();
    });

    it("'campanha Sextou' pode ser desligada sem escolher modelo", async () => {
      renderPage();
      await screen.findAllByText("campanha Sextou");
      fireEvent.click(within(rowOf("campanha Sextou")).getByRole("button", { name: "Pausar" }));
      await waitFor(() => expect(api.setCampaignTemplateEnabled).toHaveBeenCalledWith("t-sextou", false));
    });

    it("'campanha Sextou' pode ficar só com push: tira o WhatsApp e salva", async () => {
      renderPage();
      await screen.findAllByText("campanha Sextou");
      fireEvent.click(within(rowOf("campanha Sextou")).getByRole("button", { name: "Editar" }));
      await screen.findByRole("heading", { name: "Editar campanha automática" });
      fireEvent.click(continuar());
      fireEvent.click(await screen.findByRole("button", { name: "WhatsApp" }));
      fireEvent.click(continuar());
      fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
      fireEvent.click(await screen.findByRole("button", { name: "Salvar alterações" }));
      await waitFor(() => expect(api.updateCampaignTemplate).toHaveBeenCalled());
      const [id, payload] = api.updateCampaignTemplate.mock.calls[0];
      expect(id).toBe("t-sextou");
      expect(payload.channels).toEqual(["PUSH"]);
    });

    it("'campanha Sextou' pode escolher um modelo aprovado e salvar", async () => {
      renderPage();
      await screen.findAllByText("campanha Sextou");
      fireEvent.click(within(rowOf("campanha Sextou")).getByRole("button", { name: "Editar" }));
      await screen.findByRole("heading", { name: "Editar campanha automática" });
      fireEvent.click(continuar());
      fireEvent.click(await screen.findByRole("radio", { name: /Publique sua primeira vaga/ }));
      fireEvent.click(continuar());
      fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
      fireEvent.click(await screen.findByRole("button", { name: "Salvar alterações" }));
      await waitFor(() => expect(api.updateCampaignTemplate).toHaveBeenCalled());
      expect(api.updateCampaignTemplate.mock.calls[0][1].marketingTemplateId).toBe("mkt-1");
    });

    it("'Sextou' (só push) edita sem exigir modelo e liga/desliga", async () => {
      renderPage();
      await screen.findAllByText("campanha Sextou");
      fireEvent.click(within(rowOf("Sextou")).getByRole("button", { name: "Pausar" }));
      await waitFor(() => expect(api.setCampaignTemplateEnabled).toHaveBeenCalledWith("t-sextou-push", false));
      fireEvent.click(within(rowOf("Sextou")).getByRole("button", { name: "Editar" }));
      await screen.findByRole("heading", { name: "Editar campanha automática" });
      fireEvent.click(continuar());
      fireEvent.click(continuar());
      fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
      expect(await screen.findByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
    });
  });
});

describe("CampanhasAutomaticasPage — última execução e histórico (spec 2026-10-01 parte 2 §8.5)", () => {
  const lastRun = {
    id: "w-2",
    occurrence: "2026-10-02",
    channel: "WHATSAPP" as const,
    status: "COMPLETED" as const,
    startedAt: "2026-10-02T12:00:00.000Z",
    sent: 190,
    delivered: 180,
    read: 120,
    clicked: 30,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.listCampaignTemplates.mockResolvedValue({
      data: [{ ...reativacao, lastRun }],
      meta: { schedulerEnabled: true, templatesSchedulerEnabled: true },
    });
    mkt.listMarketingTemplates.mockResolvedValue([approved()]);
    ref.getAudienceOptions.mockResolvedValue({ total: 0, cities: [] });
    api.listCampaignTemplateRuns.mockResolvedValue({
      total: 1,
      page: 1,
      pageSize: 20,
      items: [
        {
          id: "w-2",
          name: "Reativação — 2026-10-02",
          occurrence: "2026-10-02",
          channel: "WHATSAPP",
          status: "COMPLETED",
          startedAt: "2026-10-02T12:00:00.000Z",
          completedAt: "2026-10-02T20:00:00.000Z",
          createdAt: "2026-10-02T12:00:00.000Z",
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
        },
      ],
    });
    ref.getCampaign.mockResolvedValue({
      campaign: {
        id: "w-2",
        name: "Reativação — 2026-10-02",
        status: "COMPLETED",
        audience: "CONTRACTORS_ALL",
        audienceNote: null,
        messagesPerHour: 60,
        dailyCap: 200,
        windowStartHour: 9,
        windowEndHour: 18,
        weekdaysOnly: true,
        nextSendAt: null,
        createdAt: "2026-10-02T12:00:00.000Z",
        startedAt: "2026-10-02T12:00:00.000Z",
        completedAt: "2026-10-02T20:00:00.000Z",
      },
      stats: { PENDING: 0, SENT: 190, FAILED: 0, SKIPPED: 10 },
      byChannel: { WHATSAPP: 200, EMAIL: 0 },
      total: 200,
      estimate: { perDay: 200, days: 0 },
    });
    ref.getCampaignRecipients.mockResolvedValue({ total: 0, page: 1, pageSize: 50, items: [] });
    ref.getCampaignResults.mockResolvedValue({
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
      notReceived: [],
      clickTracking: true,
      pricePerMessageBrl: 0.35,
    });
  });

  it("a lista mostra a última execução com entregues, lidos e cliques", async () => {
    renderPage();
    expect((await screen.findAllByTestId("last-run-t-reativacao"))[0]).toHaveTextContent(
      "02/10/2026 · 180 entregues · 120 lidos · 30 cliques",
    );
    expect(screen.getAllByText("Última execução").length).toBeGreaterThan(0);
  });

  it("Ver histórico abre as execuções; Ver detalhe abre o detalhe da execução", async () => {
    renderPage();
    fireEvent.click((await screen.findAllByRole("button", { name: "Ver histórico" }))[0]);
    expect(await screen.findByRole("heading", { name: "Histórico — Reativação" })).toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("button", { name: "Ver detalhe" }))[0]);
    await waitFor(() => expect(ref.getCampaign).toHaveBeenCalledWith("w-2"));
    expect(screen.queryByRole("heading", { name: "Histórico — Reativação" })).not.toBeInTheDocument();
  });

  it("celular: Ver histórico com 44 px", async () => {
    renderPage();
    for (const button of await screen.findAllByRole("button", { name: "Ver histórico" })) {
      expect(button).toHaveClass("min-h-11");
    }
  });
});

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketingTemplateView } from "@/modules/admin/infrastructure/marketing-templates-api";
import type { Campaign } from "@/modules/admin/infrastructure/referrals-api";
import CampanhasPage from "../page";

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => "/campanhas",
}));
vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ allowed: true, isChecking: false }),
}));
vi.mock("@/modules/auth/application/use-auth", () => ({
  useAuth: () => ({ user: { email: "rebeca@freelaservicos.com.br" } }),
}));
const api = vi.hoisted(() => ({
  getCampaigns: vi.fn(),
  getCampaign: vi.fn(),
  getCampaignRecipients: vi.fn(),
  getCampaignEstimate: vi.fn(),
  setCampaignState: vi.fn(),
  unscheduleCampaign: vi.fn(),
  getAudienceOptions: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/referrals-api", async (orig) => ({
  ...(await orig<object>()),
  ...api,
}));
const mkt = vi.hoisted(() => ({ listMarketingTemplates: vi.fn() }));
vi.mock("@/modules/admin/infrastructure/marketing-templates-api", async (orig) => ({
  ...(await orig<object>()),
  ...mkt,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const row = (over: Partial<Campaign> = {}): Campaign => ({
  id: "camp-1",
  name: "Campanha Rebeca",
  status: "DRAFT",
  audience: "CONTRACTORS_ALL",
  audienceNote: null,
  messagesPerHour: 60,
  dailyCap: 200,
  windowStartHour: 9,
  windowEndHour: 18,
  weekdaysOnly: true,
  nextSendAt: null,
  createdAt: "2026-10-01T12:00:00.000Z",
  startedAt: null,
  completedAt: null,
  _count: { recipients: 425 },
  stats: { PENDING: 425, SENT: 0, FAILED: 0, SKIPPED: 0 },
  marketingTemplateId: "tpl-1",
  marketingTemplate: {
    id: "tpl-1",
    name: "Modelo Rebeca",
    status: "APPROVED",
    metaName: "mkt_modelo_rebeca_v1",
  },
  ...over,
});

const template = (over: Partial<MarketingTemplateView> = {}): MarketingTemplateView => ({
  id: "tpl-1",
  name: "Modelo Rebeca",
  metaName: "mkt_modelo_rebeca_v1",
  version: 1,
  previousVersionId: null,
  body: "Oi, {primeiro_nome}! Tudo bem?",
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
  usage: { campaigns: 1, automatic: 0 },
  ...over,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CampanhasPage />
    </QueryClientProvider>,
  );
}

describe("CampanhasPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "";
    api.getCampaigns.mockResolvedValue({ data: [row()], schedulerEnabled: true });
    api.getCampaignRecipients.mockResolvedValue({ total: 0, page: 1, pageSize: 50, items: [] });
    api.getCampaignEstimate.mockResolvedValue({
      recipients: { whatsapp: 418, email: 7, total: 425 },
      excludedByOptOut: 12,
      whatsappToSend: 418,
      pricePerMessageBrl: 0.35,
      estimatedCostBrl: 146.3,
      estimate: { perDay: 200, days: 3 },
    });
    api.getAudienceOptions.mockResolvedValue({ total: 0, cities: [] });
    mkt.listMarketingTemplates.mockResolvedValue([template()]);
  });

  it("abas Campanhas e Modelos; DevZapp sumiu da tela e da nova campanha", async () => {
    renderPage();
    expect((await screen.findAllByText("Campanha Rebeca")).length).toBeGreaterThan(0);
    expect(document.body.textContent ?? "").not.toMatch(/devzapp/i);

    fireEvent.click(screen.getByRole("button", { name: "Nova campanha" }));
    expect(screen.getByRole("heading", { name: "Nova campanha" })).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(/devzapp/i);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    fireEvent.click(screen.getByRole("button", { name: "Modelos" }));
    expect(await screen.findByRole("button", { name: "Novo modelo" })).toBeInTheDocument();
  });

  it("agendada: 'Agendada para …' na linha e Desagendar", async () => {
    api.getCampaigns.mockResolvedValue({
      data: [
        row({
          id: "camp-2",
          name: "Campanha agendada",
          status: "SCHEDULED",
          scheduledStartAt: "2026-10-02T13:00:00.000Z",
        }),
      ],
      schedulerEnabled: true,
    });
    api.unscheduleCampaign.mockResolvedValue({ campaign: row({ id: "camp-2" }) });
    renderPage();

    expect((await screen.findAllByText("Agendada para 02/10/2026, 10:00")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Desagendar" })[0]);
    await waitFor(() => expect(api.unscheduleCampaign).toHaveBeenCalledWith("camp-2"));
  });

  it("rascunho: 'Revisar e disparar' abre o resumo da campanha (passo 4)", async () => {
    renderPage();
    fireEvent.click((await screen.findAllByRole("button", { name: "Revisar e disparar" }))[0]);
    expect(await screen.findByRole("heading", { name: "Revisar campanha" })).toBeInTheDocument();
    await waitFor(() => expect(api.getCampaignEstimate).toHaveBeenCalledWith("camp-1"));
  });

  it("pausada: mostra o motivo e oferece Retomar", async () => {
    api.getCampaigns.mockResolvedValue({
      data: [row({ id: "camp-3", name: "Campanha pausada", status: "PAUSED", pausedReason: "Qualidade do número caiu na Meta" })],
      schedulerEnabled: true,
    });
    renderPage();
    expect((await screen.findAllByText("Qualidade do número caiu na Meta")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Retomar" }).length).toBeGreaterThan(0);
  });

  it("?campanha= (link do e-mail de resposta) abre o detalhe", async () => {
    nav.search = "campanha=camp-1";
    api.getCampaign.mockResolvedValue({
      campaign: row(),
      stats: { PENDING: 425, SENT: 0, FAILED: 0, SKIPPED: 0 },
      byChannel: { WHATSAPP: 418, EMAIL: 7 },
      total: 425,
      estimate: { perDay: 200, days: 3 },
    });
    renderPage();
    await waitFor(() => expect(api.getCampaign).toHaveBeenCalledWith("camp-1"));
    expect(await screen.findByTestId("detail-meta")).toBeInTheDocument();
  });

  it("campanha antiga (sem modelo) lista e abre o detalhe sem erro", async () => {
    const old = row({ id: "old-1", name: "Campanha antiga", status: "RUNNING", marketingTemplateId: null, marketingTemplate: null });
    api.getCampaigns.mockResolvedValue({ data: [old], schedulerEnabled: true });
    api.getCampaign.mockResolvedValue({
      campaign: old,
      stats: { PENDING: 1, SENT: 0, FAILED: 0, SKIPPED: 0 },
      byChannel: { WHATSAPP: 1, EMAIL: 0 },
      total: 1,
      estimate: { perDay: 200, days: 1 },
    });
    renderPage();
    fireEvent.click((await screen.findAllByTestId("open-campaign-old-1"))[0]);
    expect(await screen.findByTestId("detail-meta")).toBeInTheDocument();
    expect(screen.queryByTestId("detail-template")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Encerrar" }).length).toBeGreaterThan(0);
  });

  it("aviso do agendador desligado continua na página", async () => {
    api.getCampaigns.mockResolvedValue({ data: [row()], schedulerEnabled: false });
    renderPage();
    expect(await screen.findByText(/agendador está/)).toBeInTheDocument();
  });

  it("?campanha= muda com a página aberta: o detalhe abre sem recarregar", async () => {
    api.getCampaign.mockResolvedValue({
      campaign: row({ id: "camp-9" }),
      stats: { PENDING: 1, SENT: 0, FAILED: 0, SKIPPED: 0 },
      byChannel: { WHATSAPP: 1, EMAIL: 0 },
      total: 1,
      estimate: { perDay: 200, days: 1 },
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const tree = () => (
      <QueryClientProvider client={qc}>
        <CampanhasPage />
      </QueryClientProvider>
    );
    const { rerender } = render(tree());
    await screen.findAllByText("Campanha Rebeca");
    expect(api.getCampaign).not.toHaveBeenCalled();
    nav.search = "campanha=camp-9";
    rerender(tree());
    await waitFor(() => expect(api.getCampaign).toHaveBeenCalledWith("camp-9"));
  });

  it("'Usar' na aba Modelos abre a nova campanha já com o modelo", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Modelos" }));
    fireEvent.click(await screen.findByRole("button", { name: "Usar" }));

    expect(await screen.findByRole("heading", { name: "Nova campanha" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nome da campanha"), { target: { value: "Com modelo" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("radio", { name: /Modelo Rebeca/ })).toBeChecked();
  });

  it("celular: cabeçalho em coluna e alvos de 44 px", async () => {
    renderPage();
    await screen.findAllByText("Campanha Rebeca");
    const header = screen.getByRole("heading", { name: "Campanhas de ativação" }).parentElement?.parentElement;
    expect(header).toHaveClass("flex-col", "sm:flex-row");
    expect(screen.getByRole("button", { name: "Nova campanha" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Modelos" })).toHaveClass("min-h-11");
  });
});

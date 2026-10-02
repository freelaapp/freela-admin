import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Campaign, CampaignDetail } from "@/modules/admin/infrastructure/referrals-api";
import { CampaignDetailDialog } from "./campaign-detail-dialog";

const api = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getCampaignRecipients: vi.fn(),
  unscheduleCampaign: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/referrals-api", async (orig) => ({
  ...(await orig<object>()),
  ...api,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const detail = (over: Partial<Campaign> = {}): CampaignDetail => ({
  campaign: {
    id: "camp-1",
    name: "Campanha Rebeca out/26",
    status: "SCHEDULED",
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
    marketingTemplateId: "tpl-1",
    marketingTemplate: {
      id: "tpl-1",
      name: "Apresentação Freela — Rebeca",
      status: "APPROVED",
      metaName: "mkt_apresentacao_freela_rebeca_v1",
    },
    scheduledStartAt: "2026-10-02T13:00:00.000Z",
    replyText: "Obrigado! A Rebeca vai falar com você.",
    replyAlertEmail: "rebeca@freelaservicos.com.br",
    pausedReason: null,
    ...over,
  },
  stats: { PENDING: 422, SENT: 2, FAILED: 0, SKIPPED: 1 },
  byChannel: { WHATSAPP: 418, EMAIL: 7 },
  total: 425,
  estimate: { perDay: 200, days: 3 },
  createdBy: { id: "admin-1", name: "Rebeca" },
  startedBy: null,
});

const recipients = {
  total: 3,
  page: 1,
  pageSize: 50,
  items: [
    {
      id: "r1",
      channel: "WHATSAPP",
      destination: "+5511999990001",
      displayName: "Ana",
      city: "Campinas",
      status: "SENT",
      attempts: 1,
      sentAt: "2026-10-02T13:05:00.000Z",
      failureReason: null,
      replyText: "Quero saber mais",
      repliedAt: "2026-10-02T14:00:00.000Z",
      autoRepliedAt: "2026-10-02T14:00:01.000Z",
      optedOutAt: null,
    },
    {
      id: "r2",
      channel: "WHATSAPP",
      destination: "+5511999990002",
      displayName: "Bia",
      city: "Campinas",
      status: "SENT",
      attempts: 1,
      sentAt: "2026-10-02T13:06:00.000Z",
      failureReason: null,
      replyText: null,
      optedOutAt: "2026-10-02T14:00:00.000Z",
    },
    {
      id: "r3",
      channel: "WHATSAPP",
      destination: "+5511999990003",
      displayName: "Cid",
      city: "Campinas",
      status: "SKIPPED",
      attempts: 0,
      sentAt: null,
      failureReason: "Pediu para não receber campanhas.",
    },
  ],
};

function renderDetail() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CampaignDetailDialog campaignId="camp-1" onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("CampaignDetailDialog (campanhas pela Meta)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCampaign.mockResolvedValue(detail());
    api.getCampaignRecipients.mockResolvedValue(recipients);
    api.unscheduleCampaign.mockResolvedValue(detail({ status: "DRAFT", scheduledStartAt: null }));
  });

  it("mostra o modelo, 'Agendada para…' e a resposta automática", async () => {
    renderDetail();
    const template = await screen.findByTestId("detail-template");
    expect(template).toHaveTextContent("Modelo: Apresentação Freela — Rebeca");
    expect(within(template).getByText("Aprovado")).toBeInTheDocument();
    expect(screen.getByTestId("detail-scheduled")).toHaveTextContent("Agendada para 02/10/2026, 10:00");
    expect(screen.getByTestId("detail-meta")).toHaveTextContent(
      "Resposta automática: “Obrigado! A Rebeca vai falar com você.” · respostas avisadas em rebeca@freelaservicos.com.br",
    );
  });

  it("Desagendar volta a campanha para rascunho", async () => {
    renderDetail();
    const button = await screen.findByRole("button", { name: "Desagendar" });
    expect(button).toHaveClass("min-h-11");
    fireEvent.click(button);
    await waitFor(() => expect(api.unscheduleCampaign).toHaveBeenCalledWith("camp-1"));
    expect(toast.success).toHaveBeenCalledWith("Agendamento cancelado. A campanha voltou para rascunho.");
  });

  it("pausada: mostra o motivo", async () => {
    api.getCampaign.mockResolvedValue(
      detail({ status: "PAUSED", scheduledStartAt: null, pausedReason: "A Meta pausou o modelo: QUALITY_PENDING" }),
    );
    renderDetail();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Pausada: A Meta pausou o modelo: QUALITY_PENDING",
    );
  });

  it("destinatários: colunas Resposta e Saiu e o motivo de não recebido", async () => {
    renderDetail();
    // Tabela (md+) e cartões (celular) renderizam os dois — o CSS escolhe qual aparece.
    expect((await screen.findAllByText("“Quero saber mais”")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/02\/10\/2026, 11:00 · respondida automaticamente/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Saiu em 02/10/2026, 11:00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pediu para não receber campanhas.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Resposta").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Saiu").length).toBeGreaterThan(0);
  });
});

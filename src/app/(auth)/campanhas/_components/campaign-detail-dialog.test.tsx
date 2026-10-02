import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Campaign, CampaignDetail } from "@/modules/admin/infrastructure/referrals-api";
import { CampaignDetailDialog } from "./campaign-detail-dialog";

const api = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getCampaignRecipients: vi.fn(),
  getCampaignResults: vi.fn(),
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
  const onClose = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CampaignDetailDialog campaignId="camp-1" onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
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

describe("CampaignDetailDialog — Resultados e colunas novas (spec 2026-10-01 parte 2 §8.3)", () => {
  const resultsData = {
    recipients: 1,
    sent: 1,
    delivered: 1,
    read: 1,
    clicked: 1,
    clicks: 3,
    optedOut: 0,
    replied: 0,
    billable: 1,
    costBrl: 0.35,
    signups: 0,
    publishedVacancy: 0,
    hired: 0,
    rates: { deliveredRate: 1, readRate: 1, clickRate: 1 },
    notReceived: [],
    clickTracking: true,
    pricePerMessageBrl: 0.35,
  };
  // Datas diferentes do agendamento (10:00) para o teste falhar sem as colunas novas.
  const recipient = {
    id: "r9",
    channel: "WHATSAPP",
    destination: "+5511999990009",
    displayName: "Ana",
    city: "Campinas",
    status: "SENT",
    attempts: 1,
    sentAt: "2026-10-02T13:15:00.000Z",
    failureReason: null,
    deliveredAt: "2026-10-02T13:20:00.000Z",
    readAt: "2026-10-02T13:35:00.000Z",
    firstClickedAt: "2026-10-02T13:36:00.000Z",
    clickCount: 7,
    optedOutAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getCampaignRecipients.mockResolvedValue({
      total: 1,
      page: 1,
      pageSize: 50,
      items: [recipient],
    });
    api.getCampaignResults.mockResolvedValue(resultsData);
  });

  it("campanha que já começou abre em Resultados, no topo; Destinatários mostra a tabela", async () => {
    api.getCampaign.mockResolvedValue(
      detail({ status: "RUNNING", startedAt: "2026-10-02T12:50:00.000Z", scheduledStartAt: null }),
    );
    renderDetail();
    expect(await screen.findByTestId("results-panel")).toBeInTheDocument();
    expect(api.getCampaignResults).toHaveBeenCalledWith("camp-1");
    const tabs = screen.getAllByRole("button", { name: /^(Resultados|Destinatários)$/ });
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Resultados", "Destinatários"]);
    expect(tabs[0]).toHaveClass("min-h-11");

    fireEvent.click(screen.getByRole("button", { name: "Destinatários" }));
    expect((await screen.findAllByText("Entregue em")).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("results-panel")).not.toBeInTheDocument();
  });

  it("agendada (nada saiu ainda) abre em Destinatários e não busca resultados", async () => {
    api.getCampaign.mockResolvedValue(detail());
    renderDetail();
    expect((await screen.findAllByText("Lido em")).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("results-panel")).not.toBeInTheDocument();
    expect(api.getCampaignResults).not.toHaveBeenCalled();
  });

  it("destinatários: Entregue em, Lido em e Clicou (vezes), na linha da tabela", async () => {
    api.getCampaign.mockResolvedValue(detail());
    renderDetail();
    const table = await screen.findByTestId("data-table-desktop");
    const headers = await within(table).findAllByRole("columnheader");
    const names = headers.map((h) => h.textContent);
    for (const header of ["Entregue em", "Lido em", "Clicou (vezes)", "Saiu"]) {
      expect(names).toContain(header);
    }
    const row = await waitFor(() => {
      const rows = within(table).getAllByRole("row");
      expect(rows.length).toBeGreaterThan(1);
      return rows[1];
    });
    const cells = within(row).getAllByRole("cell");
    expect(cells[names.indexOf("Entregue em")]).toHaveTextContent("02/10/2026, 10:20");
    expect(cells[names.indexOf("Lido em")]).toHaveTextContent("02/10/2026, 10:35");
    expect(cells[names.indexOf("Clicou (vezes)")]).toHaveTextContent("7");
  });

  it("tem botão Fechar de 44 px que fecha o detalhe", async () => {
    const { onClose } = renderDetail();
    const close = await screen.findByRole("button", { name: "Fechar" });
    expect(close).toHaveClass("min-h-11");
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });
});

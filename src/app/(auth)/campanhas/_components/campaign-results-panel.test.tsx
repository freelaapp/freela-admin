import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignResults } from "@/modules/admin/infrastructure/referrals-api";
import { CampaignResultsPanel } from "./campaign-results-panel";

const api = vi.hoisted(() => ({ getCampaignResults: vi.fn() }));
vi.mock("@/modules/admin/infrastructure/referrals-api", async (orig) => ({
  ...(await orig<object>()),
  ...api,
}));

const results = (over: Partial<CampaignResults> = {}): CampaignResults => ({
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
  notReceived: [
    { reason: "Pediu para não receber campanhas.", count: 10 },
    { reason: "Número não está no WhatsApp.", count: 2 },
  ],
  clickTracking: true,
  pricePerMessageBrl: 0.35,
  ...over,
});

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CampaignResultsPanel campaignId="camp-1" />
    </QueryClientProvider>,
  );
}

describe("CampaignResultsPanel (spec 2026-10-01 parte 2 §8.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCampaignResults.mockResolvedValue(results());
  });

  it("funil enviados → entregues → lidos → clicaram, com a porcentagem e a base", async () => {
    renderPanel();
    await screen.findByTestId("results-funnel");
    expect(api.getCampaignResults).toHaveBeenCalledWith("camp-1");
    expect(screen.getByTestId("funnel-sent")).toHaveTextContent("Enviados190");
    expect(screen.getByTestId("funnel-delivered")).toHaveTextContent("180");
    expect(screen.getByTestId("funnel-delivered")).toHaveTextContent(
      "95% dos enviados",
    );
    expect(screen.getByTestId("funnel-read")).toHaveTextContent(
      "67% dos entregues",
    );
    expect(screen.getByTestId("funnel-clicked")).toHaveTextContent("30");
    expect(screen.getByTestId("funnel-clicked")).toHaveTextContent(
      "17% dos entregues",
    );
  });

  it("saíram, responderam e custo estimado", async () => {
    renderPanel();
    const other = await screen.findByTestId("results-other");
    expect(other).toHaveTextContent("Saíram2");
    expect(other).toHaveTextContent("Responderam5");
    expect(other).toHaveTextContent("Custo estimado");
    expect(other).toHaveTextContent("R$ 63,00");
    expect(other).toHaveTextContent("180 cobradas × R$ 0,35");
  });

  it("depois da campanha: cadastros, vagas em 14 dias e contratações em 30 dias, sem dizer 'por causa'", async () => {
    renderPanel();
    const after = await screen.findByTestId("results-after");
    expect(
      within(after).getByRole("heading", { name: "Depois da campanha" }),
    ).toBeInTheDocument();
    expect(after).toHaveTextContent("Cadastros3");
    expect(after).toHaveTextContent("Vagas publicadas4");
    expect(after).toHaveTextContent("em até 14 dias");
    expect(after).toHaveTextContent("Contratações1");
    expect(after).toHaveTextContent("em até 30 dias");
    expect(document.body.textContent ?? "").not.toMatch(/por causa/i);
  });

  it("não receberam, por motivo", async () => {
    renderPanel();
    const list = await screen.findByTestId("results-not-received");
    expect(
      within(list).getByRole("heading", { name: "Não receberam" }),
    ).toBeInTheDocument();
    expect(list).toHaveTextContent("Pediu para não receber campanhas.10");
    expect(list).toHaveTextContent("Número não está no WhatsApp.2");
  });

  it("sem motivos, diz que ninguém ficou de fora", async () => {
    api.getCampaignResults.mockResolvedValue(results({ notReceived: [] }));
    renderPanel();
    expect(
      await screen.findByText("Ninguém ficou de fora."),
    ).toBeInTheDocument();
  });

  it("nada enviado: zeros e 0%, sem NaN", async () => {
    api.getCampaignResults.mockResolvedValue(
      results({
        recipients: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        clicked: 0,
        clicks: 0,
        optedOut: 0,
        replied: 0,
        billable: 0,
        costBrl: 0,
        signups: 0,
        publishedVacancy: 0,
        hired: 0,
        rates: { deliveredRate: 0, readRate: 0, clickRate: 0 },
        notReceived: [],
      }),
    );
    renderPanel();
    await screen.findByTestId("results-funnel");
    expect(screen.getByTestId("funnel-delivered")).toHaveTextContent(
      "0% dos enviados",
    );
    expect(screen.getByTestId("results-other")).toHaveTextContent("R$ 0,00");
    expect(document.body.textContent ?? "").not.toMatch(/NaN|Infinity/);
  });

  it('modelo sem "Contar cliques": clicaram fica "—" com o aviso', async () => {
    api.getCampaignResults.mockResolvedValue(
      results({ clickTracking: false, clicked: 0 }),
    );
    renderPanel();
    const clicked = await screen.findByTestId("funnel-clicked");
    expect(clicked).toHaveTextContent("—");
    expect(clicked).toHaveTextContent("Este modelo não conta cliques");
  });

  it("erro da API: alerta com a mensagem", async () => {
    const err = new AxiosError("fail");
    err.response = {
      data: { error: { code: "INTERNAL", message: "Erro interno." } },
    } as AxiosError["response"];
    api.getCampaignResults.mockRejectedValue(err);
    renderPanel();
    expect(await screen.findByRole("alert")).toHaveTextContent("Erro interno.");
  });

  it("celular: uma coluna, cartões empilhados", async () => {
    renderPanel();
    expect(await screen.findByTestId("results-funnel")).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-2",
    );
    expect(screen.getByTestId("results-other")).toHaveClass("grid-cols-1");
  });
});

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CampaignRun,
  CampaignTemplate,
} from "@/modules/admin/infrastructure/campaign-templates-api";
import { AutomaticRunsDialog } from "./automatic-runs-dialog";

const api = vi.hoisted(() => ({ listCampaignTemplateRuns: vi.fn() }));
vi.mock(
  "@/modules/admin/infrastructure/campaign-templates-api",
  async (orig) => ({
    ...(await orig<object>()),
    ...api,
  }),
);

const template = {
  id: "auto-1",
  name: "Reativação",
  scheduleKind: "WEEKLY",
  weekdays: [5],
  sendHour: 9,
  audience: "CONTRACTORS_ALL",
  channels: ["WHATSAPP", "PUSH"],
  enabled: true,
  lastRunFor: null,
  lastRunAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
} as CampaignTemplate;

const whatsappRun: CampaignRun = {
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
};

const pushRun: CampaignRun = {
  ...whatsappRun,
  id: "p-2",
  name: "Reativação — push — 2026-10-02",
  channel: "PUSH",
  recipients: 150,
  sent: 150,
  delivered: null,
  read: null,
  clicked: null,
  clicks: null,
  optedOut: null,
  replied: null,
  billable: null,
  costBrl: null,
  signups: null,
  publishedVacancy: null,
  hired: null,
  rates: null,
};

function renderDialog(tpl: CampaignTemplate = template) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpenRun = vi.fn();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <AutomaticRunsDialog
        template={tpl}
        onClose={onClose}
        onOpenRun={onOpenRun}
      />
    </QueryClientProvider>,
  );
  return { onOpenRun, onClose };
}

describe("AutomaticRunsDialog (spec 2026-10-01 parte 2 §7/§8.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listCampaignTemplateRuns.mockResolvedValue({
      total: 2,
      page: 1,
      pageSize: 20,
      items: [whatsappRun, pushRun],
    });
  });

  it("execuções com os números; push mostra '—' no que não se aplica", async () => {
    renderDialog();
    expect(
      await screen.findByRole("heading", { name: "Histórico — Reativação" }),
    ).toBeInTheDocument();
    expect(api.listCampaignTemplateRuns).toHaveBeenCalledWith("auto-1", {
      page: 1,
      pageSize: 20,
    });
    expect((await screen.findAllByText("02/10/2026")).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText("180 (95%)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 63,00").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("3 cadastros · 4 vagas · 1 contratação").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Push").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("Ver detalhe abre a execução escolhida", async () => {
    const { onOpenRun } = renderDialog();
    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Ver detalhe" }))[0],
    );
    expect(onOpenRun).toHaveBeenCalledWith("w-2");
  });

  it("paginação: Próxima página pede a página 2", async () => {
    api.listCampaignTemplateRuns.mockResolvedValue({
      total: 45,
      page: 1,
      pageSize: 20,
      items: [whatsappRun],
    });
    renderDialog();
    fireEvent.click(
      await screen.findByRole("button", { name: "Próxima página" }),
    );
    await waitFor(() =>
      expect(api.listCampaignTemplateRuns).toHaveBeenLastCalledWith("auto-1", {
        page: 2,
        pageSize: 20,
      }),
    );
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("sem execuções: aviso", async () => {
    api.listCampaignTemplateRuns.mockResolvedValue({
      total: 0,
      page: 1,
      pageSize: 20,
      items: [],
    });
    renderDialog();
    expect(
      await screen.findByText("Nenhuma execução ainda."),
    ).toBeInTheDocument();
  });

  it("celular: botões com 44 px", async () => {
    renderDialog();
    for (const button of await screen.findAllByRole("button", {
      name: "Ver detalhe",
    })) {
      expect(button).toHaveClass("min-h-11");
    }
    expect(screen.getByRole("button", { name: "Próxima página" })).toHaveClass(
      "min-h-11",
    );
  });

  it("Fechar fecha o histórico", async () => {
    const { onClose } = renderDialog();
    const close = await screen.findByRole("button", { name: "Fechar" });
    expect(close).toHaveClass("min-h-11");
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });

  it("anterior desabilitado na página 1 e próxima na última", async () => {
    api.listCampaignTemplateRuns.mockResolvedValue({
      total: 25,
      page: 1,
      pageSize: 20,
      items: [whatsappRun],
    });
    renderDialog();
    expect(
      await screen.findByRole("button", { name: "Página anterior" }),
    ).toBeDisabled();
    fireEvent.click(
      await screen.findByRole("button", { name: "Próxima página" }),
    );
    await waitFor(() => expect(screen.getByText("2 / 2")).toBeInTheDocument());
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Próxima página" }),
      ).toBeDisabled(),
    );
    expect(
      screen.getByRole("button", { name: "Página anterior" }),
    ).not.toBeDisabled();
  });

  it("outra automática: não mostra as execuções da anterior enquanto carrega", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const ui = (tpl: CampaignTemplate) => (
      <QueryClientProvider client={qc}>
        <AutomaticRunsDialog
          template={tpl}
          onClose={vi.fn()}
          onOpenRun={vi.fn()}
        />
      </QueryClientProvider>
    );
    const view = render(ui(template));
    expect((await screen.findAllByText("02/10/2026")).length).toBeGreaterThan(
      0,
    );
    api.listCampaignTemplateRuns.mockReturnValue(new Promise(() => {}));
    view.rerender(ui({ ...template, id: "auto-2", name: "Outra" }));
    expect(
      await screen.findByRole("heading", { name: "Histórico — Outra" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("02/10/2026")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ver detalhe" }),
    ).not.toBeInTheDocument();
  });
});

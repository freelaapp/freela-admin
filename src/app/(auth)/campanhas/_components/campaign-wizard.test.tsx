import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketingTemplateView } from "@/modules/admin/infrastructure/marketing-templates-api";
import type { Campaign } from "@/modules/admin/infrastructure/referrals-api";
import { CampaignWizard, type CampaignWizardProps } from "./campaign-wizard";

const ref = vi.hoisted(() => ({
  getAudienceOptions: vi.fn(),
  previewCampaignAudience: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  scheduleCampaign: vi.fn(),
  setCampaignState: vi.fn(),
  getCampaignEstimate: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/referrals-api", async (orig) => ({
  ...(await orig<object>()),
  ...ref,
}));
const mkt = vi.hoisted(() => ({
  listMarketingTemplates: vi.fn(),
  sendMarketingTemplateTest: vi.fn(),
}));
vi.mock(
  "@/modules/admin/infrastructure/marketing-templates-api",
  async (orig) => ({
    ...(await orig<object>()),
    ...mkt,
  }),
);
const auto = vi.hoisted(() => ({
  createCampaignTemplate: vi.fn(),
  updateCampaignTemplate: vi.fn(),
  setCampaignTemplateEnabled: vi.fn(),
}));
vi.mock(
  "@/modules/admin/infrastructure/campaign-templates-api",
  async (orig) => ({
    ...(await orig<object>()),
    ...auto,
  }),
);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

// 01/10/2026 09h00 em Brasília.
const NOW = new Date("2026-10-01T12:00:00.000Z");
const ADMIN = "rebeca@freelaservicos.com.br";

const view = (
  over: Partial<MarketingTemplateView> = {},
): MarketingTemplateView => ({
  id: "tpl-rebeca",
  name: "Apresentação Freela — Rebeca",
  metaName: "mkt_apresentacao_freela_rebeca_v1",
  version: 1,
  previousVersionId: null,
  body: "Oi, {primeiro_nome}! Tudo bem? 👋",
  paramOrder: ["primeiro_nome"],
  imageKey: null,
  imageUrl: null,
  buttons: [
    {
      type: "URL",
      text: "Cadastrar meu negócio",
      url: "https://www.freelaservicos.com.br",
    },
  ],
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
  usage: { campaigns: 0, automatic: 0 },
  ...over,
});

const campaign = (over: Partial<Campaign> = {}): Campaign => ({
  id: "camp-1",
  name: "Apresentação Freela — Rebeca",
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
  marketingTemplateId: "tpl-rebeca",
  ...over,
});

function apiError(message: string) {
  const err = new AxiosError("fail");
  err.response = {
    data: { error: { code: "X", message } },
  } as AxiosError["response"];
  return err;
}

function renderWizard(props: Partial<CampaignWizardProps> = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onDone = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <CampaignWizard
        open
        kind="avulsa"
        adminEmail={ADMIN}
        onOpenChange={onOpenChange}
        onDone={onDone}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onDone, onOpenChange };
}

const continuar = () => screen.getByRole("button", { name: "Continuar" });

/**
 * Toque duplo rápido: os dois cliques chegam antes de o React desenhar o botão travado
 * (o `busy` da mutação só aparece no próximo render).
 */
async function doubleTap(button: HTMLElement) {
  await act(async () => {
    button.click();
    button.click();
  });
}

describe("CampaignWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    ref.getAudienceOptions.mockResolvedValue({ total: 425, cities: [] });
    ref.previewCampaignAudience.mockResolvedValue({
      total: 425,
      byChannel: { WHATSAPP: 418, EMAIL: 7 },
      semCoordenada: 0,
      excludedByOptOut: 12,
    });
    ref.createCampaign.mockResolvedValue({ campaign: campaign() });
    ref.updateCampaign.mockResolvedValue({ campaign: campaign() });
    ref.scheduleCampaign.mockResolvedValue({
      campaign: campaign({ status: "SCHEDULED" }),
    });
    ref.setCampaignState.mockResolvedValue({
      campaign: campaign({ status: "RUNNING" }),
    });
    ref.getCampaignEstimate.mockResolvedValue({
      recipients: { whatsapp: 418, email: 7, total: 425 },
      excludedByOptOut: 12,
      whatsappToSend: 418,
      pricePerMessageBrl: 0.35,
      estimatedCostBrl: 146.3,
      estimate: { perDay: 200, days: 3 },
    });
    mkt.listMarketingTemplates.mockResolvedValue([
      view(),
      view({ id: "tpl-pend", name: "Vagas na sua cidade", status: "PENDING" }),
    ]);
    mkt.sendMarketingTemplateTest.mockResolvedValue({
      status: "sent",
      wamid: "wamid.1",
    });
    auto.createCampaignTemplate.mockResolvedValue({ id: "auto-1" });
    auto.setCampaignTemplateEnabled.mockResolvedValue({
      id: "auto-1",
      enabled: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("avulsa: público → modelo aprovado → agendar → resumo com custo → teste → agendar", async () => {
    const { onDone } = renderWizard();
    fireEvent.change(screen.getByLabelText("Nome da campanha"), {
      target: { value: "Apresentação Freela — Rebeca" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Contar" }));
    expect(await screen.findByText("425 pessoas")).toBeInTheDocument();
    fireEvent.click(continuar());

    fireEvent.click(
      await screen.findByRole("radio", {
        name: /Apresentação Freela — Rebeca/,
      }),
    );
    expect(
      screen.queryByRole("radio", { name: /Vagas na sua cidade/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("E-mail que recebe as respostas")).toHaveValue(
      ADMIN,
    );
    fireEvent.change(screen.getByLabelText("Resposta automática"), {
      target: {
        value: "Obrigado! A Rebeca vai falar com você pelo (11) 95090-3219.",
      },
    });
    fireEvent.click(continuar());

    fireEvent.click(screen.getByRole("button", { name: "Agendar" }));
    fireEvent.change(
      screen.getByLabelText("Data e hora (horário de Brasília)"),
      {
        target: { value: "2026-10-02T10:00" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Criar e revisar" }));

    await waitFor(() =>
      expect(ref.createCampaign).toHaveBeenCalledWith({
        name: "Apresentação Freela — Rebeca",
        audience: "CONTRACTORS_ALL",
        marketingTemplateId: "tpl-rebeca",
        replyText:
          "Obrigado! A Rebeca vai falar com você pelo (11) 95090-3219.",
        replyAlertEmail: ADMIN,
        messagesPerHour: 60,
        dailyCap: 200,
        windowStartHour: 9,
        windowEndHour: 18,
        weekdaysOnly: true,
      }),
    );
    const summary = await screen.findByTestId("review-summary");
    await waitFor(() => expect(summary).toHaveTextContent("418 mensagens"));
    expect(summary).toHaveTextContent(
      "Custo estimado na Meta: ~R$ 146 (marketing, ~R$ 0,35 cada)",
    );
    expect(summary).toHaveTextContent("Termina em: ~3 dias úteis");
    expect(summary).toHaveTextContent("+ 7 e-mails para quem não tem telefone");
    expect(summary).toHaveTextContent(
      "12 já pediram para não receber (ficam de fora)",
    );
    expect(screen.getByTestId("whatsapp-preview")).toHaveTextContent(
      "Oi, Maria! Tudo bem?",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Enviar teste para mim" }),
    );
    await waitFor(() =>
      expect(mkt.sendMarketingTemplateTest).toHaveBeenCalledWith("tpl-rebeca", {
        campaignId: "camp-1",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Agendar para sex 02/10 às 10h" }),
    );
    await waitFor(() =>
      expect(ref.scheduleCampaign).toHaveBeenCalledWith(
        "camp-1",
        "2026-10-02T10:00:00-03:00",
      ),
    );
    expect(onDone).toHaveBeenCalledWith({ campaignId: "camp-1" });
  });

  it("rascunho com modelo em análise: abre no resumo, sem disparar nem testar", async () => {
    mkt.listMarketingTemplates.mockResolvedValue([
      view({ id: "tpl-pend", name: "Vagas na sua cidade", status: "PENDING" }),
    ]);
    renderWizard({
      resumeCampaign: campaign({ marketingTemplateId: "tpl-pend" }),
    });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "O modelo ainda não foi aprovado pela Meta (situação: em análise).",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Disparar agora" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Enviar teste para mim" }),
    ).toBeDisabled();
    expect(ref.getCampaignEstimate).toHaveBeenCalledWith("camp-1");
    expect(screen.getByTestId("review-layout")).toHaveClass(
      "grid-cols-1",
      "lg:grid-cols-2",
    );
  });

  it("disparar agora; o 409 da API aparece na mensagem", async () => {
    ref.setCampaignState.mockRejectedValueOnce(
      apiError(
        "O modelo precisa estar aprovado pela Meta. Situação atual: pausado pela Meta.",
      ),
    );
    renderWizard({ resumeCampaign: campaign() });

    const disparar = await screen.findByRole("button", {
      name: "Disparar agora",
    });
    await waitFor(() => expect(disparar).toBeEnabled());
    fireEvent.click(disparar);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "O modelo precisa estar aprovado pela Meta. Situação atual: pausado pela Meta.",
      ),
    );
    expect(ref.setCampaignState).toHaveBeenCalledWith("camp-1", "start");
  });

  it("rascunho: voltar ao passo 1 mostra o público congelado e deixa seguir", async () => {
    renderWizard({
      resumeCampaign: campaign({
        audience: "EXTERNAL_LIST",
        optInConfirmed: true,
      }),
    });
    fireEvent.click(await screen.findByRole("button", { name: "1. Público" }));
    expect(
      screen.getByText(
        "O público foi congelado quando a campanha foi criada. Para mudar, encerre esta campanha e crie outra.",
      ),
    ).toBeInTheDocument();
    expect(continuar()).toBeEnabled();
  });

  it("planilha: não segue sem a lista conferida e sem a caixa de aceite", () => {
    renderWizard({ initialAudience: "EXTERNAL_LIST" });
    fireEvent.change(screen.getByLabelText("Nome da campanha"), {
      target: { value: "Lista feira" },
    });
    expect(screen.getByTestId("step-blocker")).toHaveTextContent(
      "Suba a planilha e confira a lista.",
    );
    expect(continuar()).toBeDisabled();
    expect(
      screen.getByRole("checkbox", {
        name: /Essas pessoas aceitaram receber mensagens da Freela\./,
      }),
    ).not.toBeChecked();
  });

  it("'Usar' na aba Modelos já chega com o modelo escolhido", async () => {
    renderWizard({ initialTemplateId: "tpl-rebeca" });
    fireEvent.change(screen.getByLabelText("Nome da campanha"), {
      target: { value: "Teste x" },
    });
    fireEvent.click(continuar());
    expect(
      await screen.findByRole("radio", {
        name: /Apresentação Freela — Rebeca/,
      }),
    ).toBeChecked();
  });

  it("automática: WhatsApp com modelo, toda sexta, resumo por execução e 'Salvar e ligar'", async () => {
    const { onDone } = renderWizard({ kind: "automatica" });
    fireEvent.change(screen.getByLabelText("Nome da campanha"), {
      target: { value: "Sextou" },
    });
    fireEvent.click(continuar());

    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));
    fireEvent.click(
      await screen.findByRole("radio", {
        name: /Apresentação Freela — Rebeca/,
      }),
    );
    fireEvent.click(continuar());

    fireEvent.click(screen.getByRole("button", { name: "Sex" }));
    fireEvent.click(continuar());

    const summary = await screen.findByTestId("review-summary");
    await waitFor(() =>
      expect(summary).toHaveTextContent("406 mensagens por execução"),
    );
    expect(summary).toHaveTextContent("~R$ 142");
    expect(summary).toHaveTextContent("12 já pediram para não receber");
    fireEvent.click(screen.getByRole("button", { name: "Salvar e ligar" }));

    await waitFor(() =>
      expect(auto.setCampaignTemplateEnabled).toHaveBeenCalledWith(
        "auto-1",
        true,
      ),
    );
    const payload = auto.createCampaignTemplate.mock.calls[0][0];
    expect(payload).toMatchObject({
      name: "Sextou",
      scheduleKind: "WEEKLY",
      weekdays: [5],
      sendHour: 9,
      channels: ["WHATSAPP"],
      marketingTemplateId: "tpl-rebeca",
      replyAlertEmail: ADMIN,
    });
    expect(payload).not.toHaveProperty("devzappFunnelUrl");
    expect(onDone).toHaveBeenCalledWith({});
  });

  it("teste: celular opcional vai na chamada e o erro da API aparece na tela", async () => {
    mkt.sendMarketingTemplateTest.mockRejectedValueOnce(
      apiError("Não sei o seu celular. Informe um número."),
    );
    renderWizard({ resumeCampaign: campaign() });
    const botao = await screen.findByRole("button", {
      name: "Enviar teste para mim",
    });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    expect(await screen.findByTestId("test-error")).toHaveTextContent(
      "Não sei o seu celular. Informe um número.",
    );
    fireEvent.change(screen.getByLabelText("Celular para o teste (opcional)"), {
      target: { value: "11950903219" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enviar teste para mim" }),
    );
    await waitFor(() =>
      expect(mkt.sendMarketingTemplateTest).toHaveBeenLastCalledWith(
        "tpl-rebeca",
        {
          campaignId: "camp-1",
          phone: "11950903219",
        },
      ),
    );
  });

  it("automática ligada com modelo não aprovado: aviso sem travar o salvamento", async () => {
    mkt.listMarketingTemplates.mockResolvedValue([
      view({ id: "tpl-pend", name: "Vagas na sua cidade", status: "PENDING" }),
    ]);
    renderWizard({
      kind: "automatica",
      editAutomatic: {
        id: "auto-1",
        name: "Sextou",
        enabled: true,
        scheduleKind: "WEEKLY",
        weekdays: [5],
        sendHour: 9,
        audience: "CONTRACTORS_ALL",
        channels: ["WHATSAPP"],
        marketingTemplateId: "tpl-pend",
      } as never,
    });
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
    expect(
      await screen.findByText(
        "O WhatsApp desta campanha só sai quando o modelo for aprovado.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar alterações" }),
    ).toBeEnabled();
  });

  it("toque duplo em 'Criar e revisar' cria UM rascunho", async () => {
    let resolveCreate: (value: unknown) => void = () => undefined;
    ref.createCampaign.mockImplementation(
      () => new Promise((resolve) => (resolveCreate = resolve)),
    );
    renderWizard({ initialTemplateId: "tpl-rebeca" });
    fireEvent.change(screen.getByLabelText("Nome da campanha"), {
      target: { value: "Apresentação" },
    });
    fireEvent.click(continuar());
    await screen.findByRole("radio", { name: /Apresentação Freela — Rebeca/ });
    fireEvent.click(continuar());

    await doubleTap(screen.getByRole("button", { name: "Criar e revisar" }));
    await act(async () => resolveCreate({ campaign: campaign() }));

    expect(await screen.findByTestId("review-summary")).toBeInTheDocument();
    expect(ref.createCampaign).toHaveBeenCalledTimes(1);
  });

  it("toque duplo em 'Disparar agora' dispara UMA vez", async () => {
    let resolveStart: (value: unknown) => void = () => undefined;
    ref.setCampaignState.mockImplementation(
      () => new Promise((resolve) => (resolveStart = resolve)),
    );
    renderWizard({ resumeCampaign: campaign() });
    const disparar = await screen.findByRole("button", {
      name: "Disparar agora",
    });
    await waitFor(() => expect(disparar).toBeEnabled());

    await doubleTap(disparar);
    await act(async () =>
      resolveStart({ campaign: campaign({ status: "RUNNING" }) }),
    );

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(ref.setCampaignState).toHaveBeenCalledTimes(1);
  });

  it("toque duplo em 'Salvar e ligar' cria UMA automática", async () => {
    let resolveCreate: (value: unknown) => void = () => undefined;
    auto.createCampaignTemplate.mockImplementation(
      () => new Promise((resolve) => (resolveCreate = resolve)),
    );
    renderWizard({ kind: "automatica" });
    fireEvent.change(screen.getByLabelText("Nome da campanha"), {
      target: { value: "Sextou" },
    });
    fireEvent.click(continuar());
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));
    fireEvent.click(
      await screen.findByRole("radio", {
        name: /Apresentação Freela — Rebeca/,
      }),
    );
    fireEvent.click(continuar());
    fireEvent.click(screen.getByRole("button", { name: "Sex" }));
    fireEvent.click(continuar());
    const ligar = await screen.findByRole("button", { name: "Salvar e ligar" });
    await waitFor(() => expect(ligar).toBeEnabled());

    await doubleTap(ligar);
    await act(async () => resolveCreate({ id: "auto-1" }));

    await waitFor(() =>
      expect(auto.setCampaignTemplateEnabled).toHaveBeenCalledTimes(1),
    );
    expect(auto.createCampaignTemplate).toHaveBeenCalledTimes(1);
  });

  it("resumo falhou: 'Disparar' fica travado com aviso até calcular de novo", async () => {
    ref.getCampaignEstimate.mockRejectedValueOnce(apiError("fora do ar"));
    renderWizard({ resumeCampaign: campaign() });

    expect(
      await screen.findByText(
        "Sem o resumo (pessoas e custo) não dá para disparar. Calcule de novo.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Disparar agora" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Calcular de novo" }));
    const summary = screen.getByTestId("review-summary");
    await waitFor(() => expect(summary).toHaveTextContent("418 mensagens"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Disparar agora" }),
      ).toBeEnabled(),
    );
  });

  it("resumo falhou com agendamento: 'Agendar' também fica travado", async () => {
    ref.getCampaignEstimate.mockRejectedValue(apiError("fora do ar"));
    renderWizard({ resumeCampaign: campaign() });
    await screen.findByText(
      "Sem o resumo (pessoas e custo) não dá para disparar. Calcule de novo.",
    );
    fireEvent.click(screen.getByRole("button", { name: "3. Quando" }));
    fireEvent.click(screen.getByRole("button", { name: "Agendar" }));
    fireEvent.change(
      screen.getByLabelText("Data e hora (horário de Brasília)"),
      { target: { value: "2026-10-02T10:00" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar e revisar" }));
    await waitFor(() => expect(ref.updateCampaign).toHaveBeenCalled());
    expect(
      await screen.findByText(
        "Sem o resumo (pessoas e custo) não dá para disparar. Calcule de novo.",
      ),
    ).toBeInTheDocument();
    const agendar = screen.getByRole("button", {
      name: "Agendar para sex 02/10 às 10h",
    });
    expect(agendar).toBeDisabled();
    fireEvent.click(agendar);
    expect(ref.scheduleCampaign).not.toHaveBeenCalled();
  });

  it("celular: passos em 2 colunas e alvos de 44 px", () => {
    renderWizard();
    expect(screen.getByTestId("wizard-steps")).toHaveClass(
      "grid-cols-2",
      "sm:grid-cols-4",
    );
    expect(continuar()).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveClass(
      "min-h-11",
    );
    expect(screen.getByRole("button", { name: "1. Público" })).toHaveClass(
      "min-h-11",
    );
  });
});

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PipelineCard,
  PipelineSettings,
  PipelineStageMessage,
} from "@/modules/admin/infrastructure/crm-api";

const api = vi.hoisted(() => ({
  getCrmPipelineSettings: vi.fn(),
  updateCrmPipelineSettings: vi.fn(),
}));

vi.mock("@/modules/admin/infrastructure/crm-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/admin/infrastructure/crm-api")>()),
  ...api,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { MessageSettingsDialog } from "./message-settings-dialog";
import { sendConfirmQuestion, stageSendCheck } from "./funnel-helpers";
import { stageMessagesPayload, stageSummary } from "./stage-messages";

const MODELO = { id: "tpl-1", name: "Boas-vindas", body: "Olá!", hasLinkButton: true };
const VOLTA = { id: "tpl-2", name: "Volta a contratar", body: "Oi!", hasLinkButton: true };
const APROVADO = { status: "APPROVED", statusLabel: "Aprovado" };

const ETAPAS: Array<[PipelineStageMessage["key"], string]> = [
  ["CADASTRO_NOVO", "Cadastro novo"],
  ["PRIMEIRA_CONTRATACAO", "1ª contratação"],
  ["SEGUNDA_CONTRATACAO", "2ª contratação"],
  ["TERCEIRA_CONTRATACAO", "3ª contratação"],
  ["CLIENTE_FIDELIZADO", "Cliente fidelizado"],
  ["CADASTROS_ANTIGOS", "Cadastros antigos"],
];

/**
 * As 6 etapas como o GET da API devolve. A API ainda manda `freeText` (texto salvo antes de
 * 18/11, se houver): o admin ignora o campo.
 */
function stages(
  over: Partial<Record<string, Partial<PipelineStageMessage> & { freeText?: string | null }>> = {},
) {
  return ETAPAS.map(([key, label]) => ({
    key,
    label,
    templateId: null,
    template: null,
    freeText: null,
    ...over[key],
  })) as unknown as PipelineStageMessage[];
}

function settings(over: Partial<PipelineSettings> = {}): PipelineSettings {
  return {
    mode: "LEGACY",
    template: null,
    availableTemplates: [MODELO, VOLTA],
    marketingWhatsapp: {
      whatsappE164: "5511971777563",
      display: "(11) 97177-7563",
      whatsappUrl: "https://wa.me/5511971777563",
      isFallback: true,
    },
    replyText: null,
    defaultReplyText: "Chame: {link_marketing}",
    replyPreview: "Chame: https://wa.me/5511971777563",
    replyAlertEmail: null,
    marketingContactUrl: "https://api.freela.test/v1/public/marketing-contact/whatsapp",
    updatedAt: null,
    updatedBy: null,
    stageMessages: stages(),
    ...over,
  };
}

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("mensagem por etapa — regras do formulário (só modelo, 18/11)", () => {
  it("resumo de cada etapa", () => {
    const nome = (id: string) => (id === "tpl-1" ? "Boas-vindas" : null);
    expect(stageSummary(undefined, nome)).toEqual({ text: "Usa a mensagem geral", warn: false });
    expect(stageSummary({ templateId: "" }, nome)).toEqual({ text: "Usa a mensagem geral", warn: false });
    expect(stageSummary({ templateId: "tpl-1" }, nome)).toEqual({ text: "Modelo: Boas-vindas", warn: false });
    expect(stageSummary({ templateId: "apagado" }, nome)).toEqual({
      text: "Modelo não encontrado: escolha outro",
      warn: true,
    });
  });

  it("o PUT leva as 6 etapas, só com o modelo (vazio vira null) e nunca o texto livre", () => {
    const payload = stageMessagesPayload(stages({ CADASTROS_ANTIGOS: { freeText: "Oi!" } }), {
      CADASTRO_NOVO: { templateId: "tpl-1" },
      PRIMEIRA_CONTRATACAO: { templateId: "  " },
    });
    expect(Object.keys(payload)).toHaveLength(6);
    expect(payload.CADASTRO_NOVO).toEqual({ templateId: "tpl-1" });
    expect(payload.PRIMEIRA_CONTRATACAO).toEqual({ templateId: null });
    expect(payload.CLIENTE_FIDELIZADO).toEqual({ templateId: null });
    for (const entry of Object.values(payload)) expect(entry).not.toHaveProperty("freeText");
  });
});

describe("confirmação antes de enviar, com modelo por etapa", () => {
  const card = {
    userId: "u1",
    name: "Bar do Zé",
    messageStatus: "NONE",
    lastMessageSentAt: null,
    messagesSentCount: 0,
  } as unknown as PipelineCard;

  it("nenhuma etapa com modelo: a confirmação fica como sempre foi (texto livre salvo não conta)", () => {
    expect(stageSendCheck(settings(), "CADASTRO_NOVO")).toBeNull();
    expect(stageSendCheck(settings({ stageMessages: undefined }), "CADASTRO_NOVO")).toBeNull();
    expect(
      stageSendCheck(settings({ stageMessages: stages({ CADASTROS_ANTIGOS: { freeText: "Oi!" } }) }), "CADASTROS_ANTIGOS"),
    ).toBeNull();
  });

  it("etapa com modelo diz o modelo; etapa sem modelo (mesmo com texto livre salvo) diz a mensagem geral", () => {
    const s = settings({
      template: { ...MODELO, ...APROVADO },
      stageMessages: stages({
        PRIMEIRA_CONTRATACAO: {
          templateId: "tpl-2",
          template: { id: "tpl-2", name: "Volta a contratar", ...APROVADO },
        },
        CADASTROS_ANTIGOS: { freeText: "Oi!" },
      }),
    });

    const modelo = stageSendCheck(s, "PRIMEIRA_CONTRATACAO");
    expect(modelo).toBe('Sai o modelo "Volta a contratar" da etapa 1ª contratação, pelo WhatsApp oficial.');
    expect(sendConfirmQuestion(card, { templateName: "Boas-vindas", messageNote: modelo })).toBe(
      'Enviar a mensagem automática de WhatsApp para Bar do Zé? Sai o modelo "Volta a contratar" da etapa 1ª contratação, pelo WhatsApp oficial.',
    );
    expect(stageSendCheck(s, "CADASTRO_NOVO")).toBe(
      'A etapa Cadastro novo não tem mensagem própria: sai a mensagem geral, o modelo "Boas-vindas".',
    );
    expect(stageSendCheck(s, "CADASTROS_ANTIGOS")).toBe(
      'A etapa Cadastros antigos não tem mensagem própria: sai a mensagem geral, o modelo "Boas-vindas".',
    );
  });
});

describe("Configurar mensagem › Mensagem por etapa", () => {
  beforeEach(() => vi.clearAllMocks());

  it("API antiga (sem etapas): a seção não aparece e o PUT não leva o campo", async () => {
    api.updateCrmPipelineSettings.mockResolvedValue(settings());
    wrap(
      <MessageSettingsDialog
        open
        onOpenChange={vi.fn()}
        settings={settings({ stageMessages: undefined })}
      />,
    );

    expect(screen.queryByText("Mensagem por etapa")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.updateCrmPipelineSettings).toHaveBeenCalled());
    expect(api.updateCrmPipelineSettings.mock.calls[0][0]).not.toHaveProperty("stageMessages");
  });

  it("cada etapa só tem o seletor de modelo, com \"Usar a mensagem geral\" em 1º; nada de texto livre", () => {
    wrap(
      <MessageSettingsDialog
        open
        onOpenChange={vi.fn()}
        settings={settings({ stageMessages: stages({ CADASTROS_ANTIGOS: { freeText: "Oi, {primeiro_nome}" } }) })}
      />,
    );

    const secao = screen.getByRole("region", { name: "Mensagem por etapa" });
    for (const [key] of ETAPAS) {
      const etapa = within(secao).getByTestId(`etapa-${key}`);
      const select = within(etapa).getByLabelText("Modelo aprovado") as HTMLSelectElement;
      expect(select.options[0]).toHaveTextContent("Usar a mensagem geral");
      expect(select.options[0].value).toBe("");
      expect(within(etapa).queryByRole("textbox")).not.toBeInTheDocument();
    }
    expect(within(secao).queryByText(/Texto livre/i)).not.toBeInTheDocument();
    expect(within(secao).queryByText(/24 h|24 horas/)).not.toBeInTheDocument();
    expect(within(secao).queryByText(/ainda não envia o texto livre/)).not.toBeInTheDocument();
    expect(within(secao).queryByText(/só tem texto livre/)).not.toBeInTheDocument();
    expect(within(secao).queryByRole("button", { name: "{primeiro_nome}" })).not.toBeInTheDocument();
    expect(within(secao).queryByText(/Como a pessoa recebe/)).not.toBeInTheDocument();
    // A etapa com texto salvo e sem modelo aparece como ela sai: a mensagem geral.
    expect(within(within(secao).getByTestId("etapa-CADASTROS_ANTIGOS")).getByText("Usa a mensagem geral")).toBeInTheDocument();
  });

  it("salvar: os modelos salvos voltam iguais, a etapa trocada vai com o novo e nenhuma leva texto livre", async () => {
    api.updateCrmPipelineSettings.mockResolvedValue(settings());
    const salvas = settings({
      stageMessages: stages({
        CADASTRO_NOVO: { templateId: "tpl-1", template: { id: "tpl-1", name: "Boas-vindas", ...APROVADO } },
        CLIENTE_FIDELIZADO: {
          templateId: "tpl-2",
          template: { id: "tpl-2", name: "Volta a contratar", ...APROVADO },
          freeText: "texto salvo antes",
        },
        CADASTROS_ANTIGOS: { freeText: "Oi, {primeiro_nome}" },
      }),
    });
    wrap(<MessageSettingsDialog open onOpenChange={vi.fn()} settings={salvas} />);

    const primeira = screen.getByTestId("etapa-PRIMEIRA_CONTRATACAO");
    fireEvent.change(within(primeira).getByLabelText("Modelo aprovado"), {
      target: { value: "tpl-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(api.updateCrmPipelineSettings).toHaveBeenCalled());
    const payload = api.updateCrmPipelineSettings.mock.calls[0][0].stageMessages;
    expect(payload).toEqual({
      CADASTRO_NOVO: { templateId: "tpl-1" },
      PRIMEIRA_CONTRATACAO: { templateId: "tpl-2" },
      SEGUNDA_CONTRATACAO: { templateId: null },
      TERCEIRA_CONTRATACAO: { templateId: null },
      CLIENTE_FIDELIZADO: { templateId: "tpl-2" },
      CADASTROS_ANTIGOS: { templateId: null },
    });
    for (const entry of Object.values(payload)) expect(entry).not.toHaveProperty("freeText");
  });

  it("voltar uma etapa para \"Usar a mensagem geral\" manda templateId null", async () => {
    api.updateCrmPipelineSettings.mockResolvedValue(settings());
    const salvas = settings({
      stageMessages: stages({
        CADASTRO_NOVO: { templateId: "tpl-1", template: { id: "tpl-1", name: "Boas-vindas", ...APROVADO } },
      }),
    });
    wrap(<MessageSettingsDialog open onOpenChange={vi.fn()} settings={salvas} />);

    const novo = screen.getByTestId("etapa-CADASTRO_NOVO");
    expect(within(novo).getByText("Modelo: Boas-vindas")).toBeInTheDocument();
    fireEvent.change(within(novo).getByLabelText("Modelo aprovado"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(api.updateCrmPipelineSettings).toHaveBeenCalled());
    expect(api.updateCrmPipelineSettings.mock.calls[0][0].stageMessages.CADASTRO_NOVO).toEqual({
      templateId: null,
    });
  });
});

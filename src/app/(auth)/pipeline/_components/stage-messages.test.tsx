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
import {
  freeTextPreview,
  freeTextProblem,
  stageMessagesPayload,
  stageSummary,
} from "./stage-messages";

const MODELO = { id: "tpl-1", name: "Boas-vindas", body: "Olá!", hasLinkButton: true };
const VOLTA = { id: "tpl-2", name: "Volta a contratar", body: "Oi!", hasLinkButton: true };

const ETAPAS: Array<[PipelineStageMessage["key"], string]> = [
  ["CADASTRO_NOVO", "Cadastro novo"],
  ["PRIMEIRA_CONTRATACAO", "1ª contratação"],
  ["SEGUNDA_CONTRATACAO", "2ª contratação"],
  ["TERCEIRA_CONTRATACAO", "3ª contratação"],
  ["CLIENTE_FIDELIZADO", "Cliente fidelizado"],
  ["CADASTROS_ANTIGOS", "Cadastros antigos"],
];

function stages(over: Partial<Record<string, Partial<PipelineStageMessage>>> = {}) {
  return ETAPAS.map(([key, label]) => ({
    key,
    label,
    templateId: null,
    template: null,
    freeText: null,
    ...over[key],
  })) as PipelineStageMessage[];
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
    stageFreeTextVariables: ["{nome}", "{primeiro_nome}", "{cidade}", "{link_marketing}"],
    stageFreeTextMax: 1000,
    serviceWindowHours: 23,
    stageFreeTextSends: false,
    ...over,
  };
}

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("mensagem por etapa — regras do formulário", () => {
  it("resumo de cada etapa", () => {
    const nome = (id: string) => (id === "tpl-1" ? "Boas-vindas" : null);
    expect(stageSummary(undefined, nome)).toEqual({ text: "Usa a mensagem geral", warn: false });
    expect(stageSummary({ templateId: "tpl-1", freeText: "" }, nome).text).toBe("Modelo: Boas-vindas");
    expect(stageSummary({ templateId: "tpl-1", freeText: "Oi" }, nome).text).toBe(
      "Modelo: Boas-vindas + texto livre",
    );
    expect(stageSummary({ templateId: "apagado", freeText: "" }, nome)).toEqual({
      text: "Modelo não encontrado: escolha outro",
      warn: true,
    });
    expect(stageSummary({ templateId: "", freeText: "Oi" }, nome)).toEqual({
      text: "Só texto livre: fora das 24 h não envia",
      warn: true,
    });
  });

  it("texto livre: variável desconhecida e tamanho", () => {
    expect(freeTextProblem("Oi, {primeiro_nome}! {link_marketing}")).toBeNull();
    expect(freeTextProblem("Oi, {empresa}")).toContain("{empresa}");
    expect(freeTextProblem("x".repeat(1001))).toContain("1001 de 1000");
  });

  it("prévia com os valores de exemplo", () => {
    expect(freeTextPreview("Oi, {primeiro_nome} de {cidade}: {link_marketing}", "https://wa.me/1")).toBe(
      "Oi, Maria de Campinas: https://wa.me/1",
    );
  });

  it("o PUT leva as 6 etapas; vazio vira null (etapa vazia = mensagem geral)", () => {
    const payload = stageMessagesPayload(stages(), {
      CADASTRO_NOVO: { templateId: "tpl-1", freeText: "  " },
      PRIMEIRA_CONTRATACAO: { templateId: "", freeText: " Oi! " },
    });
    expect(Object.keys(payload)).toHaveLength(6);
    expect(payload.CADASTRO_NOVO).toEqual({ templateId: "tpl-1", freeText: null });
    expect(payload.PRIMEIRA_CONTRATACAO).toEqual({ templateId: null, freeText: "Oi!" });
    expect(payload.CLIENTE_FIDELIZADO).toEqual({ templateId: null, freeText: null });
  });
});

describe("confirmação antes de enviar, com mensagem por etapa", () => {
  const card = {
    userId: "u1",
    name: "Bar do Zé",
    messageStatus: "NONE",
    lastMessageSentAt: null,
    messagesSentCount: 0,
  } as unknown as PipelineCard;

  it("nenhuma etapa configurada: a confirmação fica como sempre foi", () => {
    expect(stageSendCheck(settings(), "CADASTRO_NOVO")).toBeNull();
    expect(stageSendCheck(settings({ stageMessages: undefined }), "CADASTRO_NOVO")).toBeNull();
  });

  it("etapa com modelo, sem nada e só com texto livre", () => {
    const s = settings({
      template: { ...MODELO, status: "APPROVED", statusLabel: "Aprovado" },
      stageMessages: stages({
        PRIMEIRA_CONTRATACAO: {
          templateId: "tpl-2",
          template: { id: "tpl-2", name: "Volta a contratar", status: "APPROVED", statusLabel: "Aprovado" },
        },
        CADASTROS_ANTIGOS: { freeText: "Oi!" },
      }),
    });

    const modelo = stageSendCheck(s, "PRIMEIRA_CONTRATACAO");
    expect(modelo).toEqual({
      note: 'Sai o modelo "Volta a contratar" da etapa 1ª contratação, pelo WhatsApp oficial.',
      blocked: false,
    });
    expect(sendConfirmQuestion(card, { templateName: "Boas-vindas", messageNote: modelo!.note })).toBe(
      'Enviar a mensagem automática de WhatsApp para Bar do Zé? Sai o modelo "Volta a contratar" da etapa 1ª contratação, pelo WhatsApp oficial.',
    );

    expect(stageSendCheck(s, "CADASTRO_NOVO")?.note).toBe(
      'A etapa Cadastro novo não tem mensagem própria: sai a mensagem geral, o modelo "Boas-vindas".',
    );
    expect(stageSendCheck(s, "CADASTROS_ANTIGOS")?.blocked).toBe(true);
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

  it("escolhe o modelo de uma etapa, escreve o texto de outra e salva as 6", async () => {
    api.updateCrmPipelineSettings.mockResolvedValue(settings());
    wrap(<MessageSettingsDialog open onOpenChange={vi.fn()} settings={settings()} />);

    expect(screen.getByText("Mensagem por etapa")).toBeInTheDocument();
    // A regra das 24 h e o aviso de que o texto livre ainda não sai.
    expect(screen.getByText(/só deixa sair modelo aprovado pela Meta/)).toBeInTheDocument();
    expect(screen.getByText(/ainda não envia o texto livre/)).toBeInTheDocument();

    const primeira = screen.getByTestId("etapa-PRIMEIRA_CONTRATACAO");
    fireEvent.change(within(primeira).getByLabelText("Modelo aprovado"), {
      target: { value: "tpl-2" },
    });
    const antigos = screen.getByTestId("etapa-CADASTROS_ANTIGOS");
    fireEvent.change(within(antigos).getByLabelText(/Texto livre/), {
      target: { value: "Oi," },
    });
    fireEvent.click(within(antigos).getByRole("button", { name: "{primeiro_nome}" }));
    // Só texto livre: o aviso e a prévia aparecem.
    expect(within(antigos).getByText(/Esta etapa só tem texto livre/)).toBeInTheDocument();
    expect(within(antigos).getByText("Oi, Maria")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(api.updateCrmPipelineSettings).toHaveBeenCalled());
    const payload = api.updateCrmPipelineSettings.mock.calls[0][0].stageMessages;
    expect(payload.PRIMEIRA_CONTRATACAO).toEqual({ templateId: "tpl-2", freeText: null });
    expect(payload.CADASTROS_ANTIGOS).toEqual({ templateId: null, freeText: "Oi, {primeiro_nome}" });
    expect(payload.CADASTRO_NOVO).toEqual({ templateId: null, freeText: null });
  });

  it("variável desconhecida no texto trava o Salvar", () => {
    wrap(<MessageSettingsDialog open onOpenChange={vi.fn()} settings={settings()} />);
    const novo = screen.getByTestId("etapa-CADASTRO_NOVO");
    fireEvent.change(within(novo).getByLabelText(/Texto livre/), {
      target: { value: "Oi {empresa}" },
    });
    expect(within(novo).getAllByText(/Variável desconhecida/).length).toBeGreaterThan(0);
    // O erro aparece também no resumo, visível com a etapa fechada.
    expect(within(novo).getByText(/^Texto livre com erro:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });
});

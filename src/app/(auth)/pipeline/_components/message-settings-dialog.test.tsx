import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PipelineSettings } from "@/modules/admin/infrastructure/crm-api";

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
import { PipelineMessageBar } from "./pipeline-message-bar";

const MODELO = {
  id: "tpl-1",
  name: "Boas-vindas do Pipeline",
  body: "Olá, {primeiro_nome}! Aqui é o time do Freela.",
  hasLinkButton: true,
};

function settings(over: Partial<PipelineSettings> = {}): PipelineSettings {
  return {
    mode: "LEGACY",
    template: null,
    availableTemplates: [MODELO],
    marketingWhatsapp: {
      whatsappE164: "5511971777563",
      display: "(11) 97177-7563",
      whatsappUrl: "https://wa.me/5511971777563",
      isFallback: true,
    },
    replyText: null,
    defaultReplyText: "Para falar com o nosso time, chame no WhatsApp: {link_marketing}",
    replyPreview: "Para falar com o nosso time, chame no WhatsApp: https://wa.me/5511971777563",
    replyAlertEmail: null,
    marketingContactUrl: "https://api.freela.test/v1/public/marketing-contact/whatsapp",
    updatedAt: null,
    updatedBy: null,
    ...over,
  };
}

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("Configurar a mensagem do Pipeline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("escolhe o modelo, grava o número do marketing normalizado e fecha", async () => {
    const onOpenChange = vi.fn();
    api.updateCrmPipelineSettings.mockResolvedValue(settings({ mode: "META" }));
    wrap(<MessageSettingsDialog open onOpenChange={onOpenChange} settings={settings()} />);

    fireEvent.change(screen.getByLabelText("Mensagem enviada"), { target: { value: "tpl-1" } });
    fireEvent.change(screen.getByLabelText("WhatsApp do marketing (celular com DDD)"), {
      target: { value: "(11) 98888-7777" },
    });
    // A prévia da resposta automática já mostra o número que está sendo digitado.
    expect(
      screen.getByText("Para falar com o nosso time, chame no WhatsApp: https://wa.me/5511988887777"),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("E-mail de aviso quando alguém responder"), {
      target: { value: " marketing@freela.test " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(api.updateCrmPipelineSettings).toHaveBeenCalledWith({
        marketingTemplateId: "tpl-1",
        marketingWhatsapp: "5511988887777",
        replyText: null,
        replyAlertEmail: "marketing@freela.test",
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("número em branco limpa (volta ao de suporte) e 'texto fixo' desliga a Meta", async () => {
    api.updateCrmPipelineSettings.mockResolvedValue(settings());
    wrap(
      <MessageSettingsDialog
        open
        onOpenChange={vi.fn()}
        settings={settings({
          mode: "META",
          template: { ...MODELO, status: "APPROVED", statusLabel: "aprovado" },
          marketingWhatsapp: {
            whatsappE164: "5511988887777",
            display: "(11) 98888-7777",
            whatsappUrl: "https://wa.me/5511988887777",
            isFallback: false,
          },
        })}
      />,
    );

    // Abre com o que está salvo.
    expect(screen.getByLabelText("Mensagem enviada")).toHaveValue("tpl-1");
    expect(screen.getByLabelText("WhatsApp do marketing (celular com DDD)")).toHaveValue(
      "(11) 98888-7777",
    );

    fireEvent.change(screen.getByLabelText("Mensagem enviada"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("WhatsApp do marketing (celular com DDD)"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(api.updateCrmPipelineSettings).toHaveBeenCalledWith({
        marketingTemplateId: null,
        marketingWhatsapp: "",
        replyText: null,
        replyAlertEmail: null,
      }),
    );
  });

  it("número que não é celular com DDD: avisa e não deixa salvar", () => {
    wrap(<MessageSettingsDialog open onOpenChange={vi.fn()} settings={settings()} />);

    fireEvent.change(screen.getByLabelText("WhatsApp do marketing (celular com DDD)"), {
      target: { value: "1198" },
    });

    expect(screen.getByText("Informe um celular com DDD, ex.: (11) 97177-7563.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("sem modelo aprovado: aponta o rascunho que precisa ir para a Meta", () => {
    wrap(
      <MessageSettingsDialog
        open
        onOpenChange={vi.fn()}
        settings={settings({ availableTemplates: [] })}
      />,
    );

    expect(screen.getByText(/Nenhum modelo aprovado pela Meta ainda/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Campanhas › Modelos" })).toHaveAttribute(
      "href",
      "/campanhas",
    );
  });

  it("modelo escolhido que a Meta pausou continua na lista, com o aviso", () => {
    wrap(
      <MessageSettingsDialog
        open
        onOpenChange={vi.fn()}
        settings={settings({
          mode: "META",
          availableTemplates: [],
          template: { ...MODELO, status: "PAUSED", statusLabel: "pausado pela Meta" },
        })}
      />,
    );

    expect(
      screen.getByRole("option", { name: "Boas-vindas do Pipeline (pausado pela Meta)" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Este modelo está pausado pela Meta/)).toBeInTheDocument();
  });

  it("fechado não desenha nada", () => {
    wrap(<MessageSettingsDialog open={false} onOpenChange={vi.fn()} settings={settings()} />);
    expect(screen.queryByText("Configurar a mensagem do Pipeline")).not.toBeInTheDocument();
  });
});

describe("Faixa da mensagem do Pipeline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("envio antigo: diz que é o texto fixo pelo chip e que o número é o de suporte", async () => {
    api.getCrmPipelineSettings.mockResolvedValue(settings());
    wrap(<PipelineMessageBar />);

    expect(
      await screen.findByText("Mensagem: texto fixo pelo chip de campanha"),
    ).toBeInTheDocument();
    expect(screen.getByText(/\(11\) 97177-7563 \(o de suporte/)).toBeInTheDocument();
  });

  it("modelo que deixou de estar aprovado: avisa antes de alguém apertar enviar", async () => {
    api.getCrmPipelineSettings.mockResolvedValue(
      settings({
        mode: "META",
        template: { ...MODELO, status: "PAUSED", statusLabel: "pausado pela Meta" },
      }),
    );
    wrap(<PipelineMessageBar />);

    expect(
      await screen.findByText(/O modelo está pausado pela Meta: os envios são recusados/),
    ).toBeInTheDocument();
  });

  it("abre a configuração pelo botão", async () => {
    api.getCrmPipelineSettings.mockResolvedValue(settings());
    wrap(<PipelineMessageBar />);

    fireEvent.click(await screen.findByRole("button", { name: /Configurar mensagem/ }));

    expect(screen.getByRole("dialog", { name: "Configurar a mensagem do Pipeline" })).toBeInTheDocument();
  });

  it("API ainda sem a rota: a faixa some e o resto da tela segue como antes", async () => {
    api.getCrmPipelineSettings.mockRejectedValue(new Error("404"));
    const { container } = wrap(<PipelineMessageBar />);

    await waitFor(() => expect(api.getCrmPipelineSettings).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

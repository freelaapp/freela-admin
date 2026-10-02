import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketingTemplateView } from "@/modules/admin/infrastructure/marketing-templates-api";
import { MarketingTemplateEditor } from "./marketing-template-editor";

const api = vi.hoisted(() => ({
  createMarketingTemplate: vi.fn(),
  updateMarketingTemplate: vi.fn(),
  submitMarketingTemplate: vi.fn(),
}));
vi.mock(
  "@/modules/admin/infrastructure/marketing-templates-api",
  async (orig) => ({
    ...(await orig<object>()),
    ...api,
  }),
);
const upload = vi.hoisted(() => ({ uploadCampaignTemplateImage: vi.fn() }));
vi.mock(
  "@/modules/admin/infrastructure/campaign-templates-api",
  async (orig) => ({
    ...(await orig<object>()),
    ...upload,
  }),
);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const view = (
  over: Partial<MarketingTemplateView> = {},
): MarketingTemplateView => ({
  id: "tpl-1",
  name: "Apresentação Freela — Rebeca",
  metaName: "mkt_apresentacao_freela_rebeca_v1",
  version: 1,
  previousVersionId: null,
  body: "Oi, {primeiro_nome}! Tudo bem?",
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
  status: "DRAFT",
  metaTemplateId: null,
  metaCategory: null,
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

function apiError(message: string) {
  const err = new AxiosError("fail");
  err.response = {
    data: { error: { code: "META_REQUEST_FAILED", message } },
  } as AxiosError["response"];
  return err;
}

function renderEditor(
  props: Partial<ComponentProps<typeof MarketingTemplateEditor>> = {},
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onSaved = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <MarketingTemplateEditor
        open
        template={null}
        onOpenChange={onOpenChange}
        onSaved={onSaved}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onSaved, onOpenChange };
}

const body = () => screen.getByLabelText("Texto") as HTMLTextAreaElement;
const enviar = () =>
  screen.getByRole("button", { name: "Enviar para aprovação" });

function fillValid() {
  fireEvent.change(screen.getByLabelText("Nome interno"), {
    target: { value: "Apresentação Freela — Rebeca" },
  });
  fireEvent.change(body(), {
    target: { value: "Oi, {primeiro_nome}! Tudo bem?" },
  });
}

describe("MarketingTemplateEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("recusa texto que começa ou termina com variável, sem chamar a API", () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText("Nome interno"), {
      target: { value: "Sextou" },
    });

    fireEvent.change(body(), { target: { value: "{primeiro_nome}, sextou!" } });
    expect(
      screen.getByText(/O texto não pode começar com uma variável/),
    ).toBeInTheDocument();

    fireEvent.change(body(), {
      target: { value: "Vagas abertas em {cidade}" },
    });
    expect(
      screen.getByText(
        "O texto não pode terminar com uma variável. Escreva algo depois dela.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(body(), {
      target: { value: "Oi {nome} {cidade}, tudo bem?" },
    });
    expect(
      screen.getByText("Duas variáveis seguidas precisam de texto entre elas."),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Salvar rascunho" }),
    ).toBeDisabled();
    expect(enviar()).toBeDisabled();
    fireEvent.click(enviar());
    expect(api.createMarketingTemplate).not.toHaveBeenCalled();
    expect(api.submitMarketingTemplate).not.toHaveBeenCalled();
  });

  it("chip insere a variável onde está o cursor; prévia com Maria; contador com {{n}}", () => {
    renderEditor();
    fireEvent.change(body(), { target: { value: "Oi, ! Tudo bem?" } });
    body().setSelectionRange(4, 4);

    fireEvent.click(screen.getByRole("button", { name: "+ {primeiro_nome}" }));

    expect(body().value).toBe("Oi, {primeiro_nome}! Tudo bem?");
    expect(screen.getByTestId("whatsapp-preview")).toHaveTextContent(
      "Oi, Maria! Tudo bem?",
    );
    // "Oi, {{1}}! Tudo bem?" tem 20 caracteres.
    expect(screen.getByTestId("body-counter")).toHaveTextContent(
      "20 / 1024 caracteres",
    );
    expect(
      screen.getByRole("button", { name: "+ {nome}" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ {cidade}" }),
    ).toBeInTheDocument();
  });

  it("até 2 botões (link e ligar) + o de sair fixo, na ordem do WhatsApp", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Ligar" }));
    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    expect(
      screen.queryByRole("button", { name: "Link" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ligar" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Texto do botão 1"), {
      target: { value: "Falar com a Rebeca" },
    });
    fireEvent.change(screen.getByLabelText("Telefone do botão 1"), {
      target: { value: "(11) 95090-3219" },
    });
    fireEvent.change(screen.getByLabelText("Texto do botão 2"), {
      target: { value: "Cadastrar meu negócio" },
    });
    fireEvent.change(screen.getByLabelText("Link do botão 2"), {
      target: { value: "http://freela.com" },
    });
    expect(
      screen.getByText(/Botão 2: o link precisa começar com https:\/\//),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Link do botão 2"), {
      target: { value: "https://www.freelaservicos.com.br" },
    });
    expect(screen.queryByText(/Botão 2: o link/)).not.toBeInTheDocument();
    expect(
      screen.getAllByTestId("preview-button").map((b) => b.textContent),
    ).toEqual([
      "Cadastrar meu negócio",
      "Falar com a Rebeca",
      "Não quero receber",
    ]);
    expect(
      screen.getByText('"Não quero receber" (sempre incluído)'),
    ).toBeInTheDocument();
  });

  it("salva e envia para aprovação; devolve o modelo em análise e fecha", async () => {
    api.createMarketingTemplate.mockResolvedValue(
      view({ id: "novo", buttons: [] }),
    );
    api.submitMarketingTemplate.mockResolvedValue(
      view({ id: "novo", buttons: [], status: "PENDING" }),
    );
    const { onSaved, onOpenChange } = renderEditor();
    fillValid();

    fireEvent.click(enviar());

    await waitFor(() =>
      expect(api.submitMarketingTemplate).toHaveBeenCalledWith("novo"),
    );
    expect(api.createMarketingTemplate).toHaveBeenCalledWith({
      name: "Apresentação Freela — Rebeca",
      body: "Oi, {primeiro_nome}! Tudo bem?",
      imageKey: null,
      buttons: [],
    });
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ id: "novo", status: "PENDING" }),
      ),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("erro da Meta fica na tela; reenviar edita o mesmo rascunho (não cria outro)", async () => {
    api.createMarketingTemplate.mockResolvedValue(
      view({ id: "novo", buttons: [] }),
    );
    api.updateMarketingTemplate.mockResolvedValue(
      view({ id: "novo", buttons: [] }),
    );
    api.submitMarketingTemplate
      .mockRejectedValueOnce(
        apiError("A Meta recusou: texto promocional demais"),
      )
      .mockResolvedValueOnce(
        view({ id: "novo", buttons: [], status: "PENDING" }),
      );
    const { onOpenChange } = renderEditor();
    fillValid();

    fireEvent.click(enviar());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A Meta recusou: texto promocional demais",
    );
    expect(toast.error).toHaveBeenCalledWith(
      "A Meta recusou: texto promocional demais",
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    fireEvent.click(enviar());
    await waitFor(() =>
      expect(api.updateMarketingTemplate).toHaveBeenCalledWith(
        "novo",
        expect.objectContaining({ body: "Oi, {primeiro_nome}! Tudo bem?" }),
      ),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(api.createMarketingTemplate).toHaveBeenCalledTimes(1);
  });

  it("recusado: mostra o motivo e o rascunho salva na mesma linha", async () => {
    api.updateMarketingTemplate.mockResolvedValue(view({ status: "REJECTED" }));
    const { onSaved } = renderEditor({
      template: view({
        status: "REJECTED",
        rejectedReason: "variável no fim do texto",
      }),
    });

    expect(
      screen.getByText("A Meta recusou: variável no fim do texto"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome interno")).toHaveValue(
      "Apresentação Freela — Rebeca",
    );
    expect(screen.getByLabelText("Link do botão 1")).toHaveValue(
      "https://www.freelaservicos.com.br",
    );

    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() =>
      expect(api.updateMarketingTemplate).toHaveBeenCalledWith("tpl-1", {
        name: "Apresentação Freela — Rebeca",
        body: "Oi, {primeiro_nome}! Tudo bem?",
        imageKey: null,
        buttons: [
          {
            type: "URL",
            text: "Cadastrar meu negócio",
            url: "https://www.freelaservicos.com.br",
          },
        ],
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("imagem: só PNG ou JPEG (a Meta não aceita WebP no topo)", () => {
    renderEditor();
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toHaveAttribute("accept", "image/png,image/jpeg");

    fireEvent.change(input, {
      target: { files: [new File(["x"], "foto.webp", { type: "image/webp" })] },
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Formato inválido. Use PNG ou JPEG.",
    );
  });

  it("celular: uma coluna e alvos de 44 px", () => {
    renderEditor();
    expect(screen.getByTestId("editor-layout")).toHaveClass(
      "grid-cols-1",
      "lg:grid-cols-2",
    );
    for (const name of [
      "Voltar",
      "Salvar rascunho",
      "Enviar para aprovação",
      "+ {primeiro_nome}",
      "Link",
    ]) {
      expect(screen.getByRole("button", { name })).toHaveClass("min-h-11");
    }
  });

  it("nome: até 120 caracteres e pelo menos 3 para salvar", () => {
    renderEditor();
    const name = screen.getByLabelText("Nome interno");
    expect(name).toHaveAttribute("maxLength", "120");
    fireEvent.change(body(), {
      target: { value: "Oi, {primeiro_nome}! Tudo bem?" },
    });

    fireEvent.change(name, { target: { value: "Oi" } });
    expect(
      screen.getByText("O nome do modelo precisa ter pelo menos 3 caracteres."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar rascunho" }),
    ).toBeDisabled();
    expect(enviar()).toBeDisabled();

    fireEvent.change(name, { target: { value: "Oi!" } });
    expect(
      screen.getByRole("button", { name: "Salvar rascunho" }),
    ).toBeEnabled();
  });

  it("imagem: o arquivo sobe com a extensão do tipo real (jpeg → .jpg, png → .png)", async () => {
    upload.uploadCampaignTemplateImage.mockResolvedValue({
      key: "freela/images/campaigns/abc.jpg",
      url: "https://s3/abc.jpg",
    });
    renderEditor();
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [new File(["x"], "foto-sem-extensao", { type: "image/jpeg" })],
      },
    });
    await waitFor(() =>
      expect(upload.uploadCampaignTemplateImage).toHaveBeenCalledTimes(1),
    );
    expect(
      (upload.uploadCampaignTemplateImage.mock.calls[0][0] as File).name,
    ).toMatch(/\.jpg$/);
    expect(
      (upload.uploadCampaignTemplateImage.mock.calls[0][0] as File).type,
    ).toBe("image/jpeg");

    fireEvent.change(input, {
      target: { files: [new File(["x"], "logo.PNG", { type: "image/png" })] },
    });
    await waitFor(() =>
      expect(upload.uploadCampaignTemplateImage).toHaveBeenCalledTimes(2),
    );
    expect(
      (upload.uploadCampaignTemplateImage.mock.calls[1][0] as File).name,
    ).toMatch(/\.png$/);
    expect(upload.uploadCampaignTemplateImage.mock.calls.length).toBe(2);
  });

  it("imagem com chave fora da regra da API trava Salvar e Enviar com a mensagem dela", () => {
    renderEditor({
      template: view({ imageKey: "freela/images/campaigns/antiga.webp" }),
    });
    expect(
      screen.getByText(
        "A imagem precisa ser PNG ou JPEG enviada pelo admin (WebP a Meta não aceita).",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar rascunho" }),
    ).toBeDisabled();
    expect(enviar()).toBeDisabled();
  });

  it("celular: o botão de enviar imagem tem 44 px", () => {
    renderEditor();
    expect(screen.getByRole("button", { name: /Enviar imagem/ })).toHaveClass(
      "min-h-11",
    );
  });
});

describe('MarketingTemplateEditor — "Contar cliques" (spec 2026-10-01 parte 2 §8.2)', () => {
  beforeEach(() => vi.clearAllMocks());

  const caixa = () => screen.getByRole("checkbox", { name: /Contar cliques/ });

  function addLink() {
    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    fireEvent.change(screen.getByLabelText("Texto do botão 1"), {
      target: { value: "Cadastrar" },
    });
    fireEvent.change(screen.getByLabelText("Link do botão 1"), {
      target: { value: "https://www.freelaservicos.com.br" },
    });
  }

  it("botão de link novo já vem com a caixa ligada e a explicação; salva com track", async () => {
    api.createMarketingTemplate.mockResolvedValue(view({ id: "novo" }));
    renderEditor();
    fillValid();
    addLink();
    expect(caixa()).toBeChecked();
    expect(
      screen.getByText(
        "o link passa por um endereço da Freela para contar quem clicou",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() =>
      expect(api.createMarketingTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          buttons: [
            {
              type: "URL",
              text: "Cadastrar",
              url: "https://www.freelaservicos.com.br",
              track: true,
            },
          ],
        }),
      ),
    );
  });

  it("desligar manda o link direto (track false)", async () => {
    api.createMarketingTemplate.mockResolvedValue(view({ id: "novo" }));
    renderEditor();
    fillValid();
    addLink();
    fireEvent.click(caixa());
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() =>
      expect(api.createMarketingTemplate.mock.calls[0][0].buttons).toEqual([
        {
          type: "URL",
          text: "Cadastrar",
          url: "https://www.freelaservicos.com.br",
          track: false,
        },
      ]),
    );
  });

  it("modelo da parte 1 em rascunho abre com a caixa desligada e editável", () => {
    renderEditor({ template: view() });
    expect(caixa()).not.toBeChecked();
    expect(caixa()).toBeEnabled();
  });

  it("modelo da parte 1 aprovado, sem rastreio: caixa desligada e travada", () => {
    renderEditor({ template: view({ status: "APPROVED" }) });
    expect(caixa()).not.toBeChecked();
    expect(caixa()).toBeDisabled();
  });

  it("aprovado e com rastreio: caixa marcada e travada", () => {
    renderEditor({
      template: view({
        status: "APPROVED",
        buttons: [
          { type: "URL", text: "Cadastrar", url: "https://a.com", track: true },
        ],
      }),
    });
    expect(caixa()).toBeChecked();
    expect(caixa()).toBeDisabled();
  });

  it("só o botão de link tem a caixa; a linha tem 44 px", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Ligar" }));
    expect(
      screen.queryByRole("checkbox", { name: /Contar cliques/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    expect(caixa().closest("label")).toHaveClass("min-h-11");
  });
});

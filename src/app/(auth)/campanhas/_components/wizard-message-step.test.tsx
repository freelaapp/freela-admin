import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketingTemplateView } from "@/modules/admin/infrastructure/marketing-templates-api";
import { initialWizardState } from "../_lib/campaign-wizard";
import { WizardMessageStep } from "./wizard-message-step";

const api = vi.hoisted(() => ({
  createMarketingTemplate: vi.fn(),
  submitMarketingTemplate: vi.fn(),
}));
vi.mock(
  "@/modules/admin/infrastructure/marketing-templates-api",
  async (orig) => ({
    ...(await orig<object>()),
    ...api,
  }),
);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const NOW = new Date("2026-10-01T12:00:00.000Z");
const ADMIN = "rebeca@freelaservicos.com.br";

const view = (
  over: Partial<MarketingTemplateView> = {},
): MarketingTemplateView => ({
  id: "tpl-1",
  name: "Modelo",
  metaName: "mkt_modelo_v1",
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

const APPROVED = view({ id: "a", name: "Publique sua primeira vaga" });
const PENDING = view({
  id: "b",
  name: "Apresentação Freela — Rebeca",
  status: "PENDING",
});
const REJECTED = view({
  id: "c",
  name: "Sentimos sua falta",
  status: "REJECTED",
});

function renderStep(
  props: Partial<ComponentProps<typeof WizardMessageStep>> = {},
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onChange = vi.fn();
  const onTemplateCreated = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <WizardMessageStep
        kind="avulsa"
        state={initialWizardState("avulsa", { adminEmail: ADMIN, now: NOW })}
        onChange={onChange}
        templates={[APPROVED, PENDING, REJECTED]}
        selectedTemplate={null}
        onTemplateCreated={onTemplateCreated}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onChange, onTemplateCreated };
}

describe("WizardMessageStep", () => {
  beforeEach(() => vi.clearAllMocks());

  it("só modelos aprovados aparecem para escolher", () => {
    const { onChange } = renderStep();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(1);
    expect(
      screen.getByRole("radio", { name: /Publique sua primeira vaga/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Apresentação Freela — Rebeca"),
    ).not.toBeInTheDocument();

    fireEvent.click(radios[0]);
    expect(onChange).toHaveBeenCalledWith({ marketingTemplateId: "a" });
  });

  it("modelo escolhido mostra a prévia com os dados de exemplo", () => {
    renderStep({
      state: {
        ...initialWizardState("avulsa", { now: NOW }),
        marketingTemplateId: "a",
      },
      selectedTemplate: APPROVED,
    });
    expect(screen.getByTestId("whatsapp-preview")).toHaveTextContent(
      "Oi, Maria! Tudo bem?",
    );
    expect(
      screen.getAllByTestId("preview-button").map((b) => b.textContent),
    ).toEqual(["Cadastrar meu negócio", "Não quero receber"]);
  });

  it("modelo ainda em análise: aviso de rascunho esperando a aprovação", () => {
    renderStep({
      state: {
        ...initialWizardState("avulsa", { now: NOW }),
        marketingTemplateId: "b",
      },
      selectedTemplate: PENDING,
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Esse modelo ainda não foi aprovado pela Meta. A campanha fica salva como rascunho esperando a aprovação",
    );
  });

  it("Escrever mensagem nova abre o editor; o modelo enviado vira o escolhido", async () => {
    api.createMarketingTemplate.mockResolvedValue(
      view({ id: "novo", status: "DRAFT", buttons: [] }),
    );
    api.submitMarketingTemplate.mockResolvedValue(
      view({ id: "novo", status: "PENDING", buttons: [] }),
    );
    const { onChange, onTemplateCreated } = renderStep();

    fireEvent.click(
      screen.getByRole("button", { name: "Escrever mensagem nova" }),
    );
    expect(
      screen.getByRole("heading", { name: "Novo modelo" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nome interno"), {
      target: { value: "Convite feira" },
    });
    fireEvent.change(screen.getByLabelText("Texto"), {
      target: { value: "Oi, {primeiro_nome}! Vem pra feira?" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enviar para aprovação" }),
    );

    await waitFor(() =>
      expect(onTemplateCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: "novo", status: "PENDING" }),
      ),
    );
    expect(onChange).toHaveBeenCalledWith({ marketingTemplateId: "novo" });
  });

  it("resposta automática e o e-mail das respostas (padrão: o do admin)", () => {
    const { onChange } = renderStep();
    expect(screen.getByLabelText("E-mail que recebe as respostas")).toHaveValue(
      ADMIN,
    );
    fireEvent.change(screen.getByLabelText("Resposta automática"), {
      target: { value: "Obrigado! A Rebeca vai falar com você." },
    });
    expect(onChange).toHaveBeenCalledWith({
      replyText: "Obrigado! A Rebeca vai falar com você.",
    });
  });

  it("automática: escolhe os canais; push tem título e corpo; sem WhatsApp não pede modelo", () => {
    const { onChange } = renderStep({
      kind: "automatica",
      state: {
        ...initialWizardState("automatica", { now: NOW }),
        channels: ["PUSH"],
      },
    });
    expect(screen.queryByText("Modelo da mensagem")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Título do push")).toBeInTheDocument();
    expect(screen.getByLabelText("Corpo do push")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));
    expect(onChange).toHaveBeenCalledWith({ channels: ["PUSH", "WHATSAPP"] });
  });

  it("modelo arquivado ou ausente: aviso claro e nova escolha", () => {
    renderStep({
      state: {
        ...initialWizardState("avulsa", { now: NOW }),
        modelNotice:
          "O modelo escolhido antes foi arquivado. Escolha outro modelo aprovado.",
      },
    });
    expect(screen.getByTestId("model-notice")).toHaveTextContent(
      "foi arquivado",
    );
    expect(screen.getByTestId("model-notice")).toHaveTextContent(
      "Escolha outro modelo",
    );
  });

  it("celular: alvos de 44 px", () => {
    renderStep();
    expect(
      screen.getByRole("button", { name: "Escrever mensagem nova" }),
    ).toHaveClass("min-h-11");
    expect(
      screen
        .getByRole("radio", { name: /Publique sua primeira vaga/ })
        .closest("label"),
    ).toHaveClass("min-h-11");
    expect(screen.getByLabelText("E-mail que recebe as respostas")).toHaveClass(
      "min-h-11",
    );
  });
});

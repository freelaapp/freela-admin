import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketingTemplateView } from "@/modules/admin/infrastructure/marketing-templates-api";
import { MarketingTemplatesTab, usageLabel } from "./marketing-templates-tab";

const api = vi.hoisted(() => ({
  listMarketingTemplates: vi.fn(),
  newMarketingTemplateVersion: vi.fn(),
  archiveMarketingTemplate: vi.fn(),
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
  buttons: [],
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

const LIBRARY = [
  view({ id: "a", name: "Apresentação Freela — Rebeca", status: "PENDING" }),
  view({
    id: "b",
    name: "Publique sua primeira vaga",
    status: "APPROVED",
    usage: { campaigns: 2, automatic: 0 },
  }),
  view({
    id: "c",
    name: "Sentimos sua falta",
    status: "REJECTED",
    rejectedReason: "variável no fim do texto",
  }),
  view({ id: "d", name: "Vagas na sua cidade", status: "DRAFT" }),
];

function renderTab(onUse = vi.fn()) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <MarketingTemplatesTab onUse={onUse} />
    </QueryClientProvider>,
  );
  return { onUse };
}

const row = (id: string) => within(screen.getByTestId(`template-row-${id}`));

describe("MarketingTemplatesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listMarketingTemplates.mockResolvedValue(LIBRARY);
  });

  it("mostra nome, situação colorida, motivo da recusa e onde é usado", async () => {
    renderTab();
    expect(
      await screen.findByText("Publique sua primeira vaga"),
    ).toBeInTheDocument();
    expect(screen.getByText("Em análise")).toHaveClass("bg-amber-200");
    expect(screen.getByText("Aprovado")).toHaveClass("bg-green-200");
    expect(screen.getByText("Recusado")).toHaveClass("bg-red-200");
    expect(screen.getByText("Rascunho")).toHaveClass("bg-gray-200");
    expect(
      screen.getByText("Motivo: variável no fim do texto"),
    ).toBeInTheDocument();
    expect(row("b").getByText("Usado em: 2 campanhas")).toBeInTheDocument();
    expect(row("a").getByText("Usado em: —")).toBeInTheDocument();
  });

  it("ações por situação", async () => {
    renderTab();
    await screen.findByText("Publique sua primeira vaga");
    const names = (id: string) =>
      row(id)
        .getAllByRole("button")
        .map((b) => b.textContent?.trim());
    expect(names("a")).toEqual(["Nova versão", "Arquivar"]);
    expect(names("b")).toEqual(["Usar", "Nova versão", "Arquivar"]);
    expect(names("c")).toEqual(["Corrigir", "Arquivar"]);
    expect(names("d")).toEqual(["Editar", "Arquivar"]);
  });

  it("Usar entrega o modelo aprovado para a página abrir a campanha", async () => {
    const { onUse } = renderTab();
    await screen.findByText("Publique sua primeira vaga");
    fireEvent.click(row("b").getByRole("button", { name: "Usar" }));
    expect(onUse).toHaveBeenCalledWith(
      expect.objectContaining({ id: "b", status: "APPROVED" }),
    );
  });

  it("Nova versão cria o rascunho e abre o editor nele", async () => {
    api.newMarketingTemplateVersion.mockResolvedValue(
      view({
        id: "b2",
        name: "Publique sua primeira vaga",
        version: 2,
        status: "DRAFT",
      }),
    );
    renderTab();
    await screen.findByText("Publique sua primeira vaga");

    fireEvent.click(row("b").getByRole("button", { name: "Nova versão" }));

    await waitFor(() =>
      expect(api.newMarketingTemplateVersion).toHaveBeenCalledWith("b"),
    );
    expect(
      await screen.findByRole("heading", { name: "Editar modelo" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome interno")).toHaveValue(
      "Publique sua primeira vaga",
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Versão 2 criada como rascunho.",
    );
  });

  it("Corrigir abre o editor no recusado", async () => {
    renderTab();
    await screen.findByText("Sentimos sua falta");
    fireEvent.click(row("c").getByRole("button", { name: "Corrigir" }));
    expect(
      await screen.findByText("A Meta recusou: variável no fim do texto"),
    ).toBeInTheDocument();
  });

  it("Arquivar pede confirmação antes", async () => {
    api.archiveMarketingTemplate.mockResolvedValue(
      view({ id: "d", status: "ARCHIVED" }),
    );
    renderTab();
    await screen.findByText("Vagas na sua cidade");

    fireEvent.click(row("d").getByRole("button", { name: "Arquivar" }));
    expect(api.archiveMarketingTemplate).not.toHaveBeenCalled();
    expect(
      row("d").getByText(
        "Some da escolha de modelo; campanhas em andamento continuam.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(row("d").getByRole("button", { name: "Sim, arquivar" }));
    await waitFor(() =>
      expect(api.archiveMarketingTemplate).toHaveBeenCalledWith("d"),
    );
  });

  it("texto com regra quebrada e reclassificação da Meta aparecem na linha", async () => {
    api.listMarketingTemplates.mockResolvedValue([
      view({
        id: "s",
        name: "Sextou",
        ruleErrors: [
          {
            code: "STARTS_WITH_VARIABLE",
            message:
              'O texto não pode começar com uma variável. Escreva algo antes, como "Oi, {primeiro_nome}!".',
          },
        ],
      }),
      view({
        id: "u",
        name: "Vagas",
        status: "APPROVED",
        categoryWarning: true,
        metaCategory: "UTILITY",
      }),
    ]);
    renderTab();
    await screen.findByTestId("template-row-s");
    expect(row("s").getByRole("alert")).toHaveTextContent(
      "Precisa de ajuste antes de enviar: O texto não pode começar com uma variável.",
    );
    expect(
      row("u").getByText(
        "A Meta classificou como UTILITY: o preço por mensagem muda, a campanha segue.",
      ),
    ).toBeInTheDocument();
  });

  it("busca pelo nome, sem acento", async () => {
    renderTab();
    await screen.findByText("Publique sua primeira vaga");
    fireEvent.change(screen.getByPlaceholderText("Buscar modelo"), {
      target: { value: "apresentacao" },
    });
    expect(
      screen.getByText("Apresentação Freela — Rebeca"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Publique sua primeira vaga"),
    ).not.toBeInTheDocument();
  });

  it("celular: linha em coluna e alvos de 44 px", async () => {
    renderTab();
    await screen.findByText("Publique sua primeira vaga");
    expect(screen.getByTestId("template-row-b")).toHaveClass(
      "flex-col",
      "sm:flex-row",
    );
    expect(screen.getByRole("button", { name: "Novo modelo" })).toHaveClass(
      "min-h-11",
    );
    for (const button of row("b").getAllByRole("button"))
      expect(button).toHaveClass("min-h-11");
  });
});

describe("usageLabel", () => {
  it("campanhas e automáticas, no singular e no plural", () => {
    expect(usageLabel({ campaigns: 0, automatic: 0 })).toBe("—");
    expect(usageLabel({ campaigns: 1, automatic: 0 })).toBe("1 campanha");
    expect(usageLabel({ campaigns: 2, automatic: 1 })).toBe(
      "2 campanhas · 1 automática",
    );
    expect(usageLabel({ campaigns: 0, automatic: 3 })).toBe("3 automáticas");
  });
});

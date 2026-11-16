import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PipelineCard,
  PipelineOldSignups,
  PipelineSettings,
} from "@/modules/admin/infrastructure/crm-api";

const api = vi.hoisted(() => ({
  getCrmOldSignups: vi.fn(),
  getCrmPipelineSettings: vi.fn(),
  sendPipelineWhatsApp: vi.fn(),
  updateCrmPipelineSettings: vi.fn(),
}));

vi.mock("@/modules/admin/infrastructure/crm-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/admin/infrastructure/crm-api")>()),
  ...api,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { toast } from "sonner";
import { OldSignupsBoard } from "./old-signups-board";

function card(over: Partial<PipelineCard>): PipelineCard {
  return {
    userId: "u1",
    name: "Bar do Zé",
    modules: ["bars-restaurants"],
    state: "SP",
    city: "Jundiaí",
    segment: "Bar",
    whatsappPhone: "5511999990000",
    hiringsCount: 0,
    registeredAt: "2026-07-01T12:00:00.000Z",
    lastMessageSentAt: null,
    messagesSentCount: 0,
    messageStatus: "NONE",
    ...over,
  };
}

const LISTA: PipelineOldSignups = {
  days: 30,
  registeredUntil: "2026-10-17",
  total: 3,
  cards: [
    card({ userId: "u1", name: "Bar do Zé" }),
    card({
      userId: "u2",
      name: "Padaria Trigo",
      city: "Campinas",
      hiringsCount: 2,
      messageStatus: "READ",
      messageChannel: "META",
      lastMessageSentAt: "2026-11-10T14:00:00.000Z",
      messageReadAt: "2026-11-10T15:00:00.000Z",
      messagesSentCount: 1,
    }),
    card({
      userId: "u3",
      name: "Bistrô Rio",
      state: "RJ",
      city: "Niterói",
      whatsappPhone: null,
      lastCampaign: { name: "Rebeca", sentAt: "2026-10-02T12:00:00.000Z" },
    }),
  ],
};

const CONFIG: PipelineSettings = {
  mode: "META",
  template: {
    id: "tpl-1",
    name: "Boas-vindas do Pipeline",
    body: "Olá, {primeiro_nome}!",
    hasLinkButton: true,
    status: "APPROVED",
    statusLabel: "aprovado",
  },
  availableTemplates: [
    { id: "tpl-1", name: "Boas-vindas do Pipeline", body: "Olá, {primeiro_nome}!", hasLinkButton: true },
  ],
  marketingWhatsapp: {
    whatsappE164: "5511988887777",
    display: "(11) 98888-7777",
    whatsappUrl: "https://wa.me/5511988887777",
    isFallback: false,
  },
  replyText: null,
  defaultReplyText: "Para falar com o nosso time: {link_marketing}",
  replyPreview: "Para falar com o nosso time: https://wa.me/5511988887777",
  replyAlertEmail: null,
  marketingContactUrl: "https://api.freela.test/v1/public/marketing-contact/whatsapp",
  updatedAt: null,
  updatedBy: null,
};

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OldSignupsBoard />
    </QueryClientProvider>,
  );
}

/** A linha de um contratante na tabela (há um botão de enviar por linha). */
function rowOf(table: ReturnType<typeof within>, name: string) {
  const row = table.getByText(name).closest("tr");
  if (!row) throw new Error(`linha de "${name}" não encontrada`);
  return within(row);
}

/** A tabela do computador (a lista também é desenhada em cartões para o celular). */
async function desktop() {
  await screen.findByText(/cadastrados há mais de 30 dias/);
  return within(screen.getByTestId("data-table-desktop"));
}

describe("Cadastros antigos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCrmOldSignups.mockResolvedValue(LISTA);
    api.getCrmPipelineSettings.mockResolvedValue(CONFIG);
    api.sendPipelineWhatsApp.mockResolvedValue({
      ok: true,
      phone: "5511999990000",
      sentAt: "2026-11-16T15:00:00.000Z",
      channel: "META",
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("diz quantos são, a conta e de onde veio, e o que cada um já recebeu", async () => {
    renderBoard();
    const table = await desktop();

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/cadastro até 17\/10\/2026/)).toBeInTheDocument();
    // A faixa do topo diz qual mensagem o botão manda.
    expect(
      screen.getByText("Mensagem: WhatsApp oficial, modelo “Boas-vindas do Pipeline”"),
    ).toBeInTheDocument();

    expect(table.getByText("Nunca recebeu nada")).toBeInTheDocument();
    expect(table.getByText(/^Lida /)).toBeInTheDocument();
    expect(table.getByText(/Recebeu a campanha "Rebeca"/)).toBeInTheDocument();
  });

  it("as opções de situação trazem a contagem, e filtrar mostra só aquela fatia", async () => {
    renderBoard();
    const table = await desktop();

    expect(screen.getByRole("button", { name: "Todos (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Só campanha (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mensagem enviada (1)" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nunca recebeu nada (1)" }));

    expect(table.getByText("Bar do Zé")).toBeInTheDocument();
    expect(table.queryByText("Padaria Trigo")).not.toBeInTheDocument();
    expect(table.queryByText("Bistrô Rio")).not.toBeInTheDocument();
    expect(screen.getByText("Mostrando 1 de 1 (filtrado de 3)")).toBeInTheDocument();
  });

  it("filtro de estado e de cidade: a cidade só oferece as do estado escolhido", async () => {
    renderBoard();
    const table = await desktop();

    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "SP" } });

    expect(table.queryByText("Bistrô Rio")).not.toBeInTheDocument();
    const cidades = within(screen.getByLabelText("Cidade"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(cidades).toEqual(["Todas as cidades", "Campinas", "Jundiaí"]);
    // As contagens seguem o estado escolhido.
    expect(screen.getByRole("button", { name: "Todos (2)" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "Campinas" } });
    expect(table.getByText("Padaria Trigo")).toBeInTheDocument();
    expect(table.queryByText("Bar do Zé")).not.toBeInTheDocument();
  });

  it("enviar pede confirmação dizendo o modelo, manda e recarrega a lista", async () => {
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderBoard();
    const table = await desktop();

    fireEvent.click(rowOf(table, "Bar do Zé").getByRole("button", { name: "Enviar mensagem" }));

    expect(confirmar).toHaveBeenCalledWith(
      'Enviar a mensagem automática de WhatsApp para Bar do Zé? Sai pelo WhatsApp oficial, com o modelo "Boas-vindas do Pipeline".',
    );
    await waitFor(() => expect(api.sendPipelineWhatsApp).toHaveBeenCalledWith("u1"));
    await waitFor(() => expect(api.getCrmOldSignups).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith(
      "Mensagem enviada pelo WhatsApp oficial para 5511999990000.",
    );
  });

  it("quem já recebeu: o botão vira 'Enviar de novo' e a confirmação avisa; cancelar não envia", async () => {
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderBoard();
    const table = await desktop();

    fireEvent.click(table.getByRole("button", { name: "Enviar de novo" }));

    expect(confirmar.mock.calls[0][0]).toContain("Padaria Trigo já recebeu a mensagem");
    expect(api.sendPipelineWhatsApp).not.toHaveBeenCalled();
  });

  it("recusa da API aparece para o admin e a lista recarrega (o motivo vem no cartão)", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.sendPipelineWhatsApp.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: { message: "Não enviado: Pediu para não receber campanhas." } } },
    });
    renderBoard();
    const table = await desktop();

    fireEvent.click(rowOf(table, "Bar do Zé").getByRole("button", { name: "Enviar mensagem" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não enviado: Pediu para não receber campanhas."),
    );
    await waitFor(() => expect(api.getCrmOldSignups).toHaveBeenCalledTimes(2));
  });

  it("sem WhatsApp cadastrado não dá para enviar", async () => {
    renderBoard();
    const table = await desktop();

    fireEvent.click(screen.getByRole("button", { name: "Só campanha (1)" }));

    expect(table.getByText("Sem WhatsApp")).toBeInTheDocument();
    expect(table.getByRole("button", { name: "Enviar mensagem" })).toBeDisabled();
  });

  it("API fora (ou ainda sem a rota): avisa e deixa tentar de novo", async () => {
    api.getCrmOldSignups.mockRejectedValue(new Error("404"));
    renderBoard();

    expect(
      await screen.findByText("Não foi possível carregar os cadastros antigos."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});

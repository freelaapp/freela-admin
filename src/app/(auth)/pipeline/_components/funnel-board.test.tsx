import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PipelineBoard, PipelineCard } from "@/modules/admin/infrastructure/crm-api";

const api = vi.hoisted(() => ({
  getCrmPipeline: vi.fn(),
  getCrmPipelineSettings: vi.fn(),
  sendPipelineWhatsApp: vi.fn(),
}));

vi.mock("@/modules/admin/infrastructure/crm-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/admin/infrastructure/crm-api")>()),
  ...api,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { FunnelBoard } from "./funnel-board";

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
    registeredAt: "2026-11-10T12:00:00.000Z",
    lastMessageSentAt: null,
    messagesSentCount: 0,
    ...over,
  };
}

const BOARD: PipelineBoard = {
  totalContractors: 4,
  columns: [
    {
      stage: "CADASTRO_NOVO",
      title: "Cadastro novo",
      count: 4,
      cards: [
        card({ userId: "u1", name: "Bar do Zé" }),
        card({
          userId: "u2",
          name: "Padaria Trigo",
          messageStatus: "DELIVERED",
          lastMessageSentAt: "2026-11-15T14:00:00.000Z",
          messageDeliveredAt: "2026-11-15T14:01:00.000Z",
          messagesSentCount: 1,
        }),
        card({
          userId: "u3",
          name: "Bistrô Rio",
          messageStatus: "FAILED",
          messageFailureReason: "Número não está no WhatsApp.",
          lastMessageSentAt: "2026-11-15T14:00:00.000Z",
          messagesSentCount: 1,
        }),
        card({ userId: "u4", name: "Cantina Sul", messageStatus: "UNCERTAIN" }),
      ],
    },
    { stage: "PRIMEIRA_CONTRATACAO", title: "1ª contratação", count: 0, cards: [] },
    { stage: "SEGUNDA_CONTRATACAO", title: "2ª contratação", count: 0, cards: [] },
    { stage: "TERCEIRA_CONTRATACAO", title: "3ª contratação", count: 0, cards: [] },
    { stage: "CLIENTE_FIDELIZADO", title: "Cliente fidelizado", count: 0, cards: [] },
  ],
};

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FunnelBoard />
    </QueryClientProvider>,
  );
}

/** O cartão de um contratante (o nome fica 2 níveis abaixo do cartão). */
async function cardOf(name: string) {
  const title = await screen.findByText(name);
  const el = title.parentElement?.parentElement;
  if (!el) throw new Error(`cartão "${name}" não encontrado`);
  return within(el);
}

describe("Funil: situação da mensagem no cartão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCrmPipeline.mockResolvedValue(BOARD);
    // API antiga, sem a rota de configuração: o funil tem de funcionar igual.
    api.getCrmPipelineSettings.mockRejectedValue(new Error("404"));
    api.sendPipelineWhatsApp.mockResolvedValue({ ok: true, phone: "5511999990000", sentAt: "x" });
  });
  afterEach(() => vi.restoreAllMocks());

  it("cada cartão diz o que houve e o botão muda com a situação", async () => {
    renderBoard();

    expect((await cardOf("Bar do Zé")).getByRole("button")).toHaveTextContent("Enviar msg automática");

    const entregue = await cardOf("Padaria Trigo");
    expect(entregue.getByText(/^Entregue /)).toBeInTheDocument();
    expect(entregue.getByRole("button")).toHaveTextContent("Enviar de novo");

    const falhou = await cardOf("Bistrô Rio");
    expect(falhou.getByText("Não chegou: Número não está no WhatsApp.")).toBeInTheDocument();
    expect(falhou.getByRole("button")).toHaveTextContent("Tentar de novo");

    const duvida = await cardOf("Cantina Sul");
    expect(duvida.getByText(/pode ter sido enviada/)).toBeInTheDocument();
    expect(duvida.getByRole("button")).toHaveTextContent("Enviar de novo");
  });

  it("'enviadas' no topo da coluna conta só o que saiu: falha e dúvida ficam de fora", async () => {
    renderBoard();
    await screen.findByText("Bar do Zé");

    expect(screen.getByText("1 enviadas")).toBeInTheDocument();
  });

  it("dúvida da Meta: a confirmação avisa que pode ter chegado antes de mandar de novo", async () => {
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderBoard();

    fireEvent.click((await cardOf("Cantina Sul")).getByRole("button"));

    expect(confirmar.mock.calls[0][0]).toContain("PODE ter chegado");
    await waitFor(() => expect(api.sendPipelineWhatsApp).toHaveBeenCalledWith("u4", "FUNNEL"));
  });
});

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  GroupBroadcastLastRound,
  GroupBroadcastPreview,
} from "@/modules/admin/infrastructure/vacancy-group-broadcasts-api";
import type { OutreachRecord } from "@/modules/admin/infrastructure/vacancy-outreach-api";

import { GroupDispatchBadge } from "./group-dispatch-badge";
import { VacancyDispatchCell } from "./vacancy-dispatch-cell";

const api = vi.hoisted(() => ({
  getVacancyGroupBroadcasts: vi.fn(),
  getVacancyGroupBroadcastPreview: vi.fn(),
  resendVacancyGroupMessage: vi.fn(),
}));

vi.mock("@/modules/admin/infrastructure/vacancy-group-broadcasts-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getVacancyGroupBroadcasts: api.getVacancyGroupBroadcasts,
  getVacancyGroupBroadcastPreview: api.getVacancyGroupBroadcastPreview,
}));

vi.mock("@/modules/admin/infrastructure/vacancy-outreach-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resendVacancyGroupMessage: api.resendVacancyGroupMessage,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const T0912 = "2026-10-14T12:12:00.000Z";

const PREVIA: GroupBroadcastPreview = {
  radiusKm: 30,
  vacancyCity: "Campinas",
  vacancyUf: "SP",
  centerSource: "VACANCY",
  ownCityHasGroup: true,
  fallbackUsed: false,
  canResend: true,
  resendBlockedReason: null,
  destinations: [
    { groupJid: "c", groupName: "Vagas Freela Campinas SP", city: "Campinas", uf: "SP", distanceKm: 4, reason: "VACANCY_CITY" },
    { groupJid: "v", groupName: "Vagas Freela Vinhedo SP", city: "Vinhedo", uf: "SP", distanceKm: 12, reason: "RADIUS" },
  ],
  skipped: [
    { groupJid: "j", groupName: "Vagas Freela Jundiaí SP", city: "Jundiaí", uf: "SP", distanceKm: 29, reason: "RADIUS" },
  ],
};

/** Contrato final: `total` = tentados; `failed` é a lista (≤3), o número é `failedCount`. */
function rodada(over: Partial<GroupBroadcastLastRound> = {}): GroupBroadcastLastRound {
  return {
    roundId: "auto:v1",
    mode: "AUTO",
    at: T0912,
    total: 4,
    sent: 4,
    failedCount: 0,
    failed: [],
    skipped: 0,
    pending: 0,
    ownCity: 1,
    inRadius: 3,
    fallback: 0,
    vip: 0,
    ...over,
  };
}

function registro(over: Partial<OutreachRecord> = {}): OutreachRecord {
  return {
    vacancyId: "v1",
    stage: "groupBroadcast",
    lastSentAt: T0912,
    sendCount: 1,
    autoSentAt: T0912,
    ...over,
  };
}

function renderCell(record: OutreachRecord | undefined, broadcastAt?: string | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <VacancyDispatchCell vacancyId="v1" record={record} module="empresa" broadcastAt={broadcastAt} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.getVacancyGroupBroadcasts.mockReset();
  api.getVacancyGroupBroadcastPreview.mockReset();
  api.resendVacancyGroupMessage.mockReset();
  api.getVacancyGroupBroadcastPreview.mockResolvedValue(PREVIA);
  for (const fn of Object.values(toast)) vi.mocked(fn).mockClear();
});

describe("GroupDispatchBadge", () => {
  it("parte falhou: ⚠ 3 de 4 grupos · 09:12, conta no title", () => {
    render(
      <GroupDispatchBadge
        record={registro({
          groupBroadcast: {
            lastRound: rodada({
              sent: 3,
              failedCount: 1,
              failed: [{ groupName: "Vagas Freela Vinhedo SP", errorMessage: "O bot não está no grupo." }],
            }),
          },
        })}
      />,
    );
    const selo = screen.getByTestId("group-dispatch-badge");
    expect(selo).toHaveTextContent("⚠ 3 de 4 grupos · 09:12");
    expect(selo).toHaveClass("text-amber-700");
    expect(selo.getAttribute("title")).toContain(
      "Recebeu em 3 de 4 grupos (tentados: 1 da cidade da vaga + 3 a até 30 km). Não recebeu: Vagas Freela Vinhedo SP. Motivo: O bot não está no grupo.",
    );
  });

  it("API antiga (sem groupBroadcast): o selo de antes", () => {
    render(<GroupDispatchBadge record={registro()} />);
    expect(screen.getByTestId("group-dispatch-badge")).toHaveTextContent("✓ automático 09:12");
  });

  it("nunca tentou: ✗ Não divulgada", () => {
    render(<GroupDispatchBadge record={undefined} />);
    expect(screen.getByTestId("group-dispatch-badge")).toHaveTextContent("✗ Não divulgada");
  });
});

describe("VacancyDispatchCell (Empresas)", () => {
  it("todos receberam: selo verde e 'Reenviar' com o aviso no title", () => {
    renderCell(
      registro({
        groupBroadcast: {
          lastRound: rodada(),
        },
      }),
    );
    expect(screen.getByTestId("group-dispatch-badge")).toHaveTextContent("✓ 4 grupos · auto 09:12");
    expect(screen.getByRole("button", { name: "Reenviar" })).toHaveAttribute(
      "title",
      "Manda de novo para todos os grupos a até 30 km da vaga, inclusive os que já receberam.",
    );
    // Nada é lido por linha antes de alguém pedir o reenvio.
    expect(api.getVacancyGroupBroadcastPreview).not.toHaveBeenCalled();
    expect(api.getVacancyGroupBroadcasts).not.toHaveBeenCalled();
  });

  it("rodada ainda na fila: selo 'enviando' e o botão travado (sem rodada por cima)", () => {
    renderCell(
      registro({
        groupBroadcast: {
          lastRound: rodada({ sent: 1, pending: 3 }),
        },
      }),
    );
    expect(screen.getByTestId("group-dispatch-badge")).toHaveTextContent("… enviando 1 de 4 grupos");
    expect(screen.getByRole("button", { name: "Enviando…" })).toBeDisabled();
  });

  it("rodada que falhou inteira (lastSentAt nulo): ✗ Falhou e o botão diz 'Enviar'", () => {
    renderCell(
      registro({
        lastSentAt: null,
        sendCount: 0,
        autoSentAt: null,
        groupBroadcast: {
          lastRound: rodada({
            sent: 0,
            failedCount: 4,
            failed: [{ groupName: "Vagas Freela Campinas SP", errorMessage: "WhatsApp desconectado." }],
          }),
        },
      }),
    );
    const selo = screen.getByTestId("group-dispatch-badge");
    expect(selo).toHaveTextContent("✗ Falhou · 09:12");
    expect(selo).toHaveAttribute(
      "title",
      "Tentamos 4 grupos em 14/10 às 09:12 e nenhum recebeu. Motivo: WhatsApp desconectado.",
    );
    expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled();
  });

  it("confirmação aberta pela lista: vaga bloqueada mostra o porquê e não deixa enviar", async () => {
    api.getVacancyGroupBroadcastPreview.mockResolvedValue({
      ...PREVIA,
      canResend: false,
      resendBlockedReason: "Só dá para divulgar vaga aberta.",
    });
    renderCell(registro({ groupBroadcast: { lastRound: rodada() } }));
    fireEvent.click(screen.getByRole("button", { name: "Reenviar" }));
    const dialogo = await screen.findByRole("dialog");
    expect(await within(dialogo).findByText("Só dá para divulgar vaga aberta.")).toBeInTheDocument();
    expect(within(dialogo).getByText("Não dá para divulgar esta vaga agora")).toBeInTheDocument();
    expect(within(dialogo).queryByRole("button", { name: /^Reenviar/ })).not.toBeInTheDocument();
    expect(api.resendVacancyGroupMessage).not.toHaveBeenCalled();
  });

  it("vaga que saiu antes do registro (groupBroadcastAt) não vira 'Não divulgada'", () => {
    renderCell(undefined, T0912);
    expect(screen.getByTestId("group-dispatch-badge")).toHaveTextContent("✓ enviado");
    expect(screen.getByRole("button", { name: "Reenviar" })).toBeInTheDocument();
  });

  it("reenviar: confirma pela lista da prévia, manda uma vez e avisa o resultado da fila", async () => {
    api.resendVacancyGroupMessage.mockResolvedValue({ roundId: "r9", destinations: PREVIA.destinations });
    api.getVacancyGroupBroadcasts.mockResolvedValue({
      radiusKm: 30,
      groupBroadcastAt: T0912,
      inFlight: 0,
      canResend: true,
      resendBlockedReason: null,
      rounds: [
        {
          roundId: "r9",
          mode: "MANUAL",
          createdAt: T0912,
          radiusKm: 30,
          centerSource: "VACANCY",
          summary: {
            total: 2, sent: 2, failedCount: 0, failed: [], skipped: 0, pending: 0, ownCity: 1, inRadius: 1, fallback: 0, vip: 0,
          },
          destinations: PREVIA.destinations.map((d) => ({
            ...d,
            status: "SENT",
            errorCode: null,
            error: null,
            sentAt: T0912,
          })),
        },
      ],
    });
    renderCell(registro());

    fireEvent.click(screen.getByRole("button", { name: "Reenviar" }));
    const dialogo = await screen.findByRole("dialog");
    expect(await within(dialogo).findByText("Reenviar a vaga para 2 grupos?")).toBeInTheDocument();
    expect(within(dialogo).getByText("Vagas Freela Campinas SP · Campinas-SP · 4 km")).toBeInTheDocument();
    expect(within(dialogo).getByText("Vagas Freela Vinhedo SP · Vinhedo-SP · 12 km")).toBeInTheDocument();
    expect(
      within(dialogo).getByText("1 grupo fica de fora pelo limite de 8 cidades vizinhas e 20 grupos por vaga:"),
    ).toBeInTheDocument();
    expect(within(dialogo).getByText("Vagas Freela Jundiaí SP · Jundiaí-SP · 29 km")).toBeInTheDocument();

    const confirmar = within(dialogo).getByRole("button", { name: "Reenviar para 2 grupos" });
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Vaga enviada a 2 grupos."));
    expect(api.resendVacancyGroupMessage).toHaveBeenCalledTimes(1);
    expect(api.resendVacancyGroupMessage).toHaveBeenCalledWith("v1", "empresa");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

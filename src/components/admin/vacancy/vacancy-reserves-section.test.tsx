import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VacancyReservesSection } from "./vacancy-reserves-section";
import type { VacancyReservesView } from "@/modules/admin/infrastructure/admin-api";

const api = vi.hoisted(() => ({
  getVacancyReserves: vi.fn(),
  adminOpenReserveCall: vi.fn(),
  adminCancelReserveCall: vi.fn(),
}));

vi.mock("@/modules/admin/infrastructure/admin-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getVacancyReserves: api.getVacancyReserves,
  adminOpenReserveCall: api.adminOpenReserveCall,
  adminCancelReserveCall: api.adminCancelReserveCall,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const reserva = (id: string, name: string, position: number, status = "HELD") => ({
  candidacyId: id,
  name,
  averageRating: 4.8,
  city: "Jundiaí",
  matchScore: 92,
  reserveId: `r-${id}`,
  position,
  status,
  designatedBy: "SYSTEM",
});

const VIEW: VacancyReservesView = {
  enabled: true,
  max: 2,
  holdUntil: "2026-10-31T20:00:00.000Z", // 17:00 em Brasília
  principal: { candidacyId: "c-ana", name: "Ana Souza" },
  reserves: [reserva("c-bia", "Bia Lima", 1), reserva("c-cai", "Cai Rocha", 2)],
  eligible: [],
  openCall: null,
  history: { calls: [], principalChanges: [] },
};

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VacancyReservesSection vacancyId="v1" />
    </QueryClientProvider>,
  );
}

describe("VacancyReservesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("mostra as reservas na ordem e até quando ficam de prontidão", async () => {
    api.getVacancyReserves.mockResolvedValue(VIEW);
    renderSection();

    expect(await screen.findByText("Bia Lima")).toBeInTheDocument();
    expect(screen.getByText("Reserva 1")).toBeInTheDocument();
    expect(screen.getByText("Reserva 2")).toBeInTheDocument();
    expect(screen.getByText(/De prontidão até 17:00/)).toBeInTheDocument();
  });

  it('"Chamar reserva" manda o motivo com a chave de idempotência', async () => {
    api.getVacancyReserves.mockResolvedValue(VIEW);
    api.adminOpenReserveCall.mockResolvedValue({});
    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: /Chamar reserva/ }));
    expect(screen.getByText("Chamar Bia (reserva 1) no lugar da empresa?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Chamar Bia" }));

    await waitFor(() =>
      expect(api.adminOpenReserveCall).toHaveBeenCalledWith(
        "v1",
        { reason: "PRESTART_NO_RESPONSE" },
        expect.stringMatching(/^admin-reserve-v1-/),
      ),
    );
  });

  it('"Outro motivo" só chama com a nota', async () => {
    api.getVacancyReserves.mockResolvedValue(VIEW);
    api.adminOpenReserveCall.mockResolvedValue({});
    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: /Chamar reserva/ }));
    fireEvent.click(screen.getByLabelText("Outro motivo"));
    expect(screen.getByRole("button", { name: "Chamar Bia" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "empresa pediu por telefone" } });
    fireEvent.click(screen.getByRole("button", { name: "Chamar Bia" }));

    await waitFor(() =>
      expect(api.adminOpenReserveCall).toHaveBeenCalledWith(
        "v1",
        { reason: "CONTRACTOR_CHOICE", note: "empresa pediu por telefone" },
        expect.any(String),
      ),
    );
  });

  it("chamada aberta: mostra quem foi chamada e cancela mantendo o escolhido", async () => {
    api.getVacancyReserves.mockResolvedValue({
      ...VIEW,
      reserves: [reserva("c-bia", "Bia Lima", 1, "OFFERED"), reserva("c-cai", "Cai Rocha", 2)],
      openCall: {
        callId: "call-1",
        status: "OPEN",
        reason: "PRESTART_NO_RESPONSE",
        closeReason: null,
        createdAt: "2026-10-31T18:30:00.000Z",
        offeredTo: { candidacyId: "c-bia", name: "Bia", position: 1, expiresAt: "2026-10-31T18:45:00.000Z" },
      },
    });
    api.adminCancelReserveCall.mockResolvedValue(undefined);
    renderSection();

    expect(await screen.findByText(/Chamada aberta: Bia \(reserva 1\) tem até 15:45/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Chamar reserva/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar a chamada (manter Ana)" }));

    await waitFor(() => expect(api.adminCancelReserveCall).toHaveBeenCalledWith("v1", "call-1"));
  });

  it("histórico: troca e chamada, com nomes e quem pediu", async () => {
    api.getVacancyReserves.mockResolvedValue({
      ...VIEW,
      principal: { candidacyId: "c-bia", name: "Bia Lima" },
      reserves: [reserva("c-cai", "Cai Rocha", 1)],
      history: {
        calls: [
          {
            id: "call-1",
            status: "FILLED",
            reason: "PRINCIPAL_WITHDREW",
            note: null,
            closeReason: null,
            requestedByKind: "SYSTEM",
            replacedCandidacyId: "c-ana",
            filledByCandidacyId: "c-bia",
            createdAt: "2026-10-31T17:00:00.000Z",
            closedAt: "2026-10-31T17:05:00.000Z",
            offers: [
              {
                candidacyId: "c-bia",
                position: 1,
                status: "ACCEPTED",
                offeredAt: "2026-10-31T17:00:00.000Z",
                offerExpiresAt: "2026-10-31T17:15:00.000Z",
              },
            ],
          },
        ],
        principalChanges: [
          {
            id: "pc-1",
            kind: "SUBSTITUTED",
            fromCandidacyId: "c-ana",
            toCandidacyId: "c-bia",
            reason: "PRINCIPAL_WITHDREW",
            note: null,
            actorKind: "SYSTEM",
            occurredAt: "2026-10-31T17:05:00.000Z",
          },
        ],
      },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <VacancyReservesSection
          vacancyId="v1"
          candidacies={[{ id: "c-ana", providerName: "Ana Souza" } as never]}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/Ana Souza saiu e Bia Lima entrou/)).toBeInTheDocument();
    expect(screen.getByText(/o sistema chamou a reserva no lugar de Ana Souza/)).toBeInTheDocument();
    expect(screen.getByText(/Bia Lima \(reserva 1\): aceitou/)).toBeInTheDocument();
    expect(screen.getByText(/Uma reserva aceitou: Bia Lima entrou/)).toBeInTheDocument();
  });

  it("chave desligada e sem histórico: não mostra nada", async () => {
    api.getVacancyReserves.mockResolvedValue({ ...VIEW, enabled: false, reserves: [] });
    const { container } = renderSection();
    await waitFor(() => expect(api.getVacancyReserves).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("erro da API (vaga de outro módulo): não mostra nada", async () => {
    api.getVacancyReserves.mockRejectedValue(new Error("404"));
    const { container } = renderSection();
    await waitFor(() => expect(api.getVacancyReserves).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "sonner";

import { VacancyReservesSection } from "./vacancy-reserves-section";
import type { VacancyReservesView } from "@/modules/admin/infrastructure/admin-api";

const api = vi.hoisted(() => ({
  getVacancyReserves: vi.fn(),
  adminOpenReserveCall: vi.fn(),
  adminCancelReserveCall: vi.fn(),
  adminReplaceReserves: vi.fn(),
}));

vi.mock("@/modules/admin/infrastructure/admin-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getVacancyReserves: api.getVacancyReserves,
  adminOpenReserveCall: api.adminOpenReserveCall,
  adminCancelReserveCall: api.adminCancelReserveCall,
  adminReplaceReserves: api.adminReplaceReserves,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const reserva = (
  id: string,
  name: string,
  position: number,
  status = "HELD",
) => ({
  candidacyId: id,
  name,
  averageRating: 4.8,
  city: "Jundiaí",
  matchScore: 92,
  reserveId: `r-${id}`,
  position,
  status,
  designatedBy: "CONTRACTOR",
});

const VIEW: VacancyReservesView = {
  enabled: true,
  max: 2,
  holdUntil: "2026-10-31T20:00:00.000Z", // 17:00 em Brasília
  principal: { candidacyId: "c-ana", name: "Ana Souza" },
  chosen: [reserva("c-bia", "Bia Lima", 1), reserva("c-cai", "Cai Rocha", 2)],
  candidates: [],
  canChoose: true,
  canCall: true,
  reserves: [],
  eligible: [],
  openCall: null,
  history: { calls: [], principalChanges: [] },
};

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <VacancyReservesSection vacancyId="v1" />
    </QueryClientProvider>,
  );
}

describe("VacancyReservesSection (lista escolhida pela empresa, 28/10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("mostra a lista da empresa na ordem, até quando vale e que elas não sabem", async () => {
    api.getVacancyReserves.mockResolvedValue(VIEW);
    renderSection();

    expect(await screen.findByText("Bia Lima")).toBeInTheDocument();
    expect(screen.getByText("Reserva 1")).toBeInTheDocument();
    expect(screen.getByText("Reserva 2")).toBeInTheDocument();
    expect(screen.getAllByText("Escolhida pela empresa")).toHaveLength(2);
    expect(screen.getByText(/Valem até 17:00/)).toBeInTheDocument();
    expect(
      screen.getByText(/Elas não sabem que estão na lista/),
    ).toBeInTheDocument();
  });

  it('lista escolhida e vaga ainda não paga: sem "Chamar reserva", com o motivo', async () => {
    api.getVacancyReserves.mockResolvedValue({ ...VIEW, canCall: false });
    renderSection();

    expect(await screen.findByText("Bia Lima")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Chamar reserva/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/depois que a empresa pagar a vaga/),
    ).toBeInTheDocument();
  });

  it("empresa não escolheu: diz isso e quantos outros candidatos poderiam entrar", async () => {
    api.getVacancyReserves.mockResolvedValue({
      ...VIEW,
      chosen: [],
      canCall: false,
      candidates: [{ candidacyId: "c-davi", name: "Davi Melo" }],
    });
    renderSection();

    expect(
      await screen.findByText(
        "A empresa não escolheu reservas. 1 outro candidato pode entrar na lista; quem escolhe é a empresa, na tela da vaga.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Chamar reserva/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/topou/)).not.toBeInTheDocument();
  });

  it("API anterior (sem chosen/canCall): usa reserves e deixa chamar", async () => {
    api.getVacancyReserves.mockResolvedValue({
      ...VIEW,
      chosen: undefined,
      candidates: undefined,
      canChoose: undefined,
      canCall: undefined,
      reserves: [reserva("c-bia", "Bia Lima", 1, "HELD")],
    });
    renderSection();

    expect(await screen.findByText("Bia Lima")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Chamar reserva/ }),
    ).toBeInTheDocument();
  });

  it('"Chamar reserva" manda o motivo com a chave de idempotência', async () => {
    api.getVacancyReserves.mockResolvedValue(VIEW);
    api.adminOpenReserveCall.mockResolvedValue({});
    renderSection();

    fireEvent.click(
      await screen.findByRole("button", { name: /Chamar reserva/ }),
    );
    expect(
      screen.getByText("Chamar Bia (reserva 1) no lugar da empresa?"),
    ).toBeInTheDocument();
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

    fireEvent.click(
      await screen.findByRole("button", { name: /Chamar reserva/ }),
    );
    fireEvent.click(screen.getByLabelText("Outro motivo"));
    expect(screen.getByRole("button", { name: "Chamar Bia" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "empresa pediu por telefone" },
    });
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
      chosen: [
        reserva("c-bia", "Bia Lima", 1, "OFFERED"),
        reserva("c-cai", "Cai Rocha", 2),
      ],
      canCall: false,
      openCall: {
        callId: "call-1",
        status: "OPEN",
        reason: "PRESTART_NO_RESPONSE",
        closeReason: null,
        createdAt: "2026-10-31T18:30:00.000Z",
        offeredTo: {
          candidacyId: "c-bia",
          name: "Bia",
          position: 1,
          expiresAt: "2026-10-31T18:45:00.000Z",
        },
      },
    });
    api.adminCancelReserveCall.mockResolvedValue(undefined);
    renderSection();

    expect(
      await screen.findByText(
        /Chamada aberta: Bia \(reserva 1\) tem até 15:45/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Chamar reserva/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Cancelar a chamada (manter Ana)" }),
    );

    await waitFor(() =>
      expect(api.adminCancelReserveCall).toHaveBeenCalledWith("v1", "call-1"),
    );
  });

  it("histórico: troca e chamada, com nomes e quem pediu", async () => {
    api.getVacancyReserves.mockResolvedValue({
      ...VIEW,
      principal: { candidacyId: "c-bia", name: "Bia Lima" },
      chosen: [reserva("c-cai", "Cai Rocha", 1)],
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
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <VacancyReservesSection
          vacancyId="v1"
          candidacies={[{ id: "c-ana", providerName: "Ana Souza" } as never]}
        />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText(/Ana Souza saiu e Bia Lima entrou/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/o sistema chamou a reserva no lugar de Ana Souza/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Bia Lima \(reserva 1\): aceitou/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Uma reserva aceitou: Bia Lima entrou/),
    ).toBeInTheDocument();
  });

  describe("o suporte escolhe no lugar da empresa (ponte até o app 1.0.45)", () => {
    const pessoa = (id: string, name: string) => ({ candidacyId: id, name });
    const SEM_LISTA: VacancyReservesView = {
      ...VIEW,
      chosen: [],
      canCall: false,
      candidates: [
        pessoa("c-bia", "Bia Lima"),
        pessoa("c-cai", "Cai Rocha"),
        pessoa("c-davi", "Davi Melo"),
      ],
    };

    it("marca na ordem do toque, avisa o que acontece e guarda", async () => {
      api.getVacancyReserves.mockResolvedValue(SEM_LISTA);
      api.adminReplaceReserves.mockResolvedValue(SEM_LISTA);
      renderSection();

      fireEvent.click(
        await screen.findByRole("button", {
          name: "Escolher reservas no lugar da empresa",
        }),
      );
      expect(screen.getByText(/Só quando a empresa pedir/)).toBeInTheDocument();
      expect(screen.getByText(/Ninguém é avisado agora/)).toBeInTheDocument();
      expect(screen.getByText(/Escolhida pelo suporte/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("checkbox", { name: "Cai Rocha" }));
      fireEvent.click(screen.getByRole("checkbox", { name: "Bia Lima" }));
      expect(
        screen.getByRole("checkbox", { name: "Cai Rocha, reserva 1" }),
      ).toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: "Davi Melo" }),
      ).toBeDisabled();
      expect(
        screen.getByText("Máximo de 2. Desmarque uma para trocar."),
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: "Guardar 2 reservas" }),
      );

      await waitFor(() =>
        expect(api.adminReplaceReserves).toHaveBeenCalledWith("v1", [
          "c-cai",
          "c-bia",
        ]),
      );
      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith(
          "Reservas guardadas: 1 Cai · 2 Bia.",
        ),
      );
    });

    it("lista já escolhida: vem marcada; desmarcar a 1 sobe a 2", async () => {
      api.getVacancyReserves.mockResolvedValue({
        ...VIEW,
        candidates: [pessoa("c-davi", "Davi Melo")],
      });
      api.adminReplaceReserves.mockResolvedValue(VIEW);
      renderSection();

      fireEvent.click(
        await screen.findByRole("button", {
          name: "Mudar reservas no lugar da empresa",
        }),
      );
      expect(
        screen.getByRole("button", { name: "Guardar 2 reservas" }),
      ).toBeDisabled();
      fireEvent.click(
        screen.getByRole("checkbox", { name: "Bia Lima, reserva 1" }),
      );
      expect(
        screen.getByRole("checkbox", { name: "Cai Rocha, reserva 1" }),
      ).toBeChecked();
      fireEvent.click(screen.getByRole("checkbox", { name: "Davi Melo" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Guardar 2 reservas" }),
      );

      await waitFor(() =>
        expect(api.adminReplaceReserves).toHaveBeenCalledWith("v1", [
          "c-cai",
          "c-davi",
        ]),
      );
    });

    it("erro da API: mostra a mensagem e o editor continua aberto", async () => {
      api.getVacancyReserves.mockResolvedValue(SEM_LISTA);
      api.adminReplaceReserves.mockRejectedValue({
        isAxiosError: true,
        response: {
          data: { error: { message: "A empresa bloqueou esta pessoa." } },
        },
      });
      renderSection();

      fireEvent.click(
        await screen.findByRole("button", {
          name: "Escolher reservas no lugar da empresa",
        }),
      );
      fireEvent.click(screen.getByRole("checkbox", { name: "Bia Lima" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Guardar 1 reserva" }),
      );

      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      expect(
        screen.getByRole("group", {
          name: "Escolher reservas no lugar da empresa",
        }),
      ).toBeInTheDocument();
    });

    it("API anterior (sem canChoose) ou chamada aberta: não oferece escolher", async () => {
      api.getVacancyReserves.mockResolvedValue({
        ...SEM_LISTA,
        canChoose: undefined,
      });
      renderSection();
      expect(
        await screen.findByText(/A empresa não escolheu reservas/),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /reservas no lugar da empresa/ }),
      ).not.toBeInTheDocument();
    });
  });

  it("histórico da lista: quem escolheu, quem tirou (com e-mail) e quem saiu sozinho", async () => {
    const linha = (over: Record<string, unknown>) => ({
      reserveId: `r-${over.candidacyId}-${over.designatedAt}`,
      position: 1,
      status: "RELEASED",
      callId: null,
      designatedBy: "CONTRACTOR",
      designatedByLabel: "rafael@bardoze.com",
      releaseReason: null,
      releasedBy: null,
      releasedByLabel: null,
      releasedAt: null,
      ...over,
    });
    const T1 = "2026-10-31T14:05:00.000Z";
    const T2 = "2026-10-31T14:20:00.000Z";
    api.getVacancyReserves.mockResolvedValue({
      ...VIEW,
      chosen: [reserva("c-cai", "Cai Rocha", 2)],
      history: {
        calls: [],
        principalChanges: [],
        reserveChanges: [
          linha({
            candidacyId: "c-cai",
            name: "Cai Rocha",
            position: 2,
            status: "HELD",
            designatedBy: "ADMIN",
            designatedByLabel: "suporte@freela.com",
            designatedAt: T2,
          }),
          linha({
            candidacyId: "c-davi",
            name: "Davi Melo",
            position: 2,
            designatedAt: T1,
            releaseReason: "REPLACED_BY_CONTRACTOR",
            releasedBy: "ADMIN",
            releasedByLabel: "suporte@freela.com",
            releasedAt: T2,
          }),
          linha({
            candidacyId: "c-bia",
            name: "Bia Lima",
            designatedAt: T1,
            releaseReason: "ACCEPTED_ELSEWHERE",
            releasedAt: "2026-10-31T15:00:00.000Z",
          }),
        ],
      },
    });
    renderSection();

    expect(
      await screen.findByText(
        /a empresa escolheu as reservas: 1 Bia · 2 Davi \(rafael@bardoze.com\)/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /o suporte escolheu as reservas: 2 Cai; tirou Davi das reservas \(suporte@freela.com\)/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Bia saiu das reservas: foi escolhida em outra vaga no mesmo horário/,
      ),
    ).toBeInTheDocument();
  });

  it("histórico da lista: mudar a ordem e o fim pelo prazo", async () => {
    const T = "2026-10-31T14:30:00.000Z";
    const base = {
      callId: null,
      designatedBy: "CONTRACTOR",
      designatedByLabel: null,
      releasedBy: null,
      releasedByLabel: null,
    };
    api.getVacancyReserves.mockResolvedValue({
      ...VIEW,
      chosen: [],
      history: {
        calls: [],
        principalChanges: [],
        reserveChanges: [
          {
            ...base,
            reserveId: "r-cai-2",
            candidacyId: "c-cai",
            name: "Cai Rocha",
            position: 1,
            status: "RELEASED",
            designatedAt: T,
            releaseReason: "HOLD_ENDED",
            releasedAt: "2026-10-31T20:00:00.000Z",
          },
          {
            ...base,
            reserveId: "r-cai-1",
            candidacyId: "c-cai",
            name: "Cai Rocha",
            position: 2,
            status: "RELEASED",
            designatedAt: "2026-10-31T14:00:00.000Z",
            releaseReason: "REORDERED",
            releasedAt: T,
          },
        ],
      },
    });
    renderSection();

    expect(
      await screen.findByText(/a empresa mudou a ordem: Cai passou para 1/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/as reservas terminaram: prazo das 17:00/),
    ).toBeInTheDocument();
  });

  it("chave desligada e sem histórico: não mostra nada", async () => {
    api.getVacancyReserves.mockResolvedValue({
      ...VIEW,
      enabled: false,
      chosen: [],
    });
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

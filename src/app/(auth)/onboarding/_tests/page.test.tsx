import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listOrientationSessions: vi.fn(),
  getOrientationSettings: vi.fn(),
  getOrientationHosts: vi.fn(),
  getOrientationSession: vi.fn(),
  createOrientationSession: vi.fn(),
  createOrientationSeries: vi.fn(),
  updateOrientationSession: vi.fn(),
  cancelOrientationSession: vi.fn(),
  cancelOrientationSeries: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/orientation-api", async (orig) => ({ ...(await orig<object>()), ...api }));
vi.mock("@/modules/admin/infrastructure/cities-catalog-api", () => ({
  getCitiesCatalog: vi.fn().mockResolvedValue([
    { name: "Campinas", uf: "SP" },
    { name: "Valinhos", uf: "SP" },
  ]),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/modules/auth/application/use-auth", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import TurmasOnboardingPage from "../page";

const settings = {
  gateMode: "OFF",
  newSignupsSince: null,
  gateFixedJobs: false,
  defaultCapacity: 15,
  maxCapacity: 20,
  defaultDurationMin: 60,
  bookingClosesMinBefore: 60,
  maxChanges: 2,
  maxNoShows: 2,
  sessionsShown: 4,
  joinOpensMinBefore: 15,
  resultGraceMin: 30,
  convocationMinDays: 7,
  dailyMessageCap: 200,
};

function makeSession(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "s1",
    startsAt: "2026-11-12T12:00:00.000Z",
    endsAt: "2026-11-12T13:00:00.000Z",
    capacity: 10,
    bookedCount: 7,
    status: "OPEN",
    hostAdminId: "me",
    hostName: "Rebeca",
    meetUrl: "https://meet.google.com/abc-defg-hij",
    meetSource: "MANUAL",
    googleSyncStatus: "NOT_CONNECTED",
    googleSyncError: null,
    audience: { ufs: [], cities: [] },
    seriesId: null,
    notes: null,
    alerts: [],
    ...over,
  };
}

const writeText = vi.fn().mockResolvedValue(undefined);

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TurmasOnboardingPage />
    </QueryClientProvider>,
  );
}

describe("Turmas do Onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-11T15:00:00Z") });
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    api.getOrientationSettings.mockResolvedValue(settings);
    api.getOrientationHosts.mockResolvedValue([
      { id: "me", name: "Rebeca", email: "r@freela.com" },
      { id: "h2", name: "Diego", email: "d@freela.com" },
    ]);
    api.listOrientationSessions.mockResolvedValue([
      makeSession({ audience: { ufs: ["SP"], cities: ["Campinas", "Valinhos"] }, alerts: ["LOW_BOOKINGS"] }),
      makeSession({
        id: "s2",
        startsAt: "2026-11-12T18:00:00.000Z",
        endsAt: "2026-11-12T19:00:00.000Z",
        bookedCount: 10,
        meetUrl: null,
        alerts: ["NO_LINK_24H"],
      }),
      makeSession({ id: "s3", startsAt: "2026-11-13T12:00:00.000Z", endsAt: "2026-11-13T13:00:00.000Z", status: "FINISHED" }),
      makeSession({ id: "s4", startsAt: "2026-11-14T12:00:00.000Z", endsAt: "2026-11-14T13:00:00.000Z", status: "CANCELLED" }),
    ]);
    api.getOrientationSession.mockResolvedValue({
      ...makeSession(),
      enrollees: [{ enrollmentId: "e1", status: "BOOKED", name: "Julia", phone: "11999990000" }],
    });
  });
  afterEach(() => vi.useRealTimers());

  it("agrupa por dia e mostra inscritos, quem dá a aula, público, situação e alertas", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "quinta, 12/11" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "sexta, 13/11" })).toBeInTheDocument();
    expect(screen.getAllByText("7/10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rebeca").length).toBeGreaterThan(0);
    expect(screen.getByText("Campinas, Valinhos · SP")).toBeInTheDocument();
    expect(screen.getAllByText("Todas as cidades").length).toBeGreaterThan(0);
    for (const label of ["Aberta", "Lotada", "Encerrada", "Cancelada"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("Poucos inscritos para a aula.")).toBeInTheDocument();
    expect(screen.getByText("Falta o link do Meet e a aula é em menos de 24 horas.")).toBeInTheDocument();
    expect(api.listOrientationSessions).toHaveBeenCalledWith({
      from: "2026-11-09T03:00:00.000Z",
      to: "2026-11-16T03:00:00.000Z",
    });
  });

  it("copia o link do Meet", async () => {
    renderPage();
    await screen.findAllByText("7/10");
    fireEvent.click(screen.getAllByRole("button", { name: /Copiar link do Meet/ })[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://meet.google.com/abc-defg-hij"));
  });

  it("troca de semana", async () => {
    renderPage();
    await screen.findAllByText("7/10");
    fireEvent.click(screen.getByRole("button", { name: "Próxima semana" }));
    await waitFor(() =>
      expect(api.listOrientationSessions).toHaveBeenLastCalledWith({
        from: "2026-11-16T03:00:00.000Z",
        to: "2026-11-23T03:00:00.000Z",
      }),
    );
  });

  describe("série", () => {
    const dates = [16, 17, 18, 19, 20, 23, 24, 25, 26, 27].map((d) => ({
      startsAt: `2026-11-${d}T12:00:00.000Z`,
      isHoliday: d === 20,
    }));

    async function openPreview() {
      renderPage();
      await screen.findAllByText("7/10");
      fireEvent.click(screen.getByRole("button", { name: "Turmas em série" }));
      fireEvent.change(await screen.findByLabelText("Link do Meet"), {
        target: { value: "https://meet.google.com/abc-defg-hij" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Ver as datas" }));
      await screen.findByText("Feriado nacional");
    }

    it("prévia com feriado, desmarcar duas datas e criar uma vez só", async () => {
      api.createOrientationSeries.mockImplementation(async (input: { dryRun: boolean }) => {
        if (input.dryRun) return { seriesId: null, sessions: dates };
        await new Promise((r) => setTimeout(r, 20));
        return { seriesId: "x", sessions: dates.slice(0, 8) };
      });
      vi.useRealTimers();
      await openPreview();
      expect(screen.getAllByRole("checkbox")).toHaveLength(10);
      expect(screen.getAllByText("Feriado nacional")).toHaveLength(1);

      const boxes = screen.getAllByRole("checkbox");
      fireEvent.click(boxes[4]);
      fireEvent.click(boxes[9]);
      const create = screen.getByRole("button", { name: "Criar 8 turmas" });
      fireEvent.click(create);
      fireEvent.click(create);

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("8 turmas criadas."));
      const calls = api.createOrientationSeries.mock.calls.map((c) => c[0]);
      const real = calls.filter((c) => !c.dryRun);
      expect(real).toHaveLength(1);
      expect(real[0].skipDates).toEqual(["2026-11-20", "2026-11-27"]);
      expect(real[0].seriesId).not.toBe(calls[0].seriesId);
      expect(real[0]).not.toHaveProperty("notes");
    });

    it("reenviar o mesmo plano mantém o seriesId; sem desmarcar nada a prévia e o envio usam o mesmo", async () => {
      let fail = true;
      api.createOrientationSeries.mockImplementation(async (input: { dryRun: boolean }) => {
        if (input.dryRun) return { seriesId: null, sessions: dates };
        if (fail) {
          fail = false;
          throw new Error("timeout");
        }
        return { seriesId: "x", sessions: dates };
      });
      vi.useRealTimers();
      await openPreview();
      fireEvent.click(screen.getByRole("button", { name: "Criar 10 turmas" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      fireEvent.click(screen.getByRole("button", { name: "Criar 10 turmas" }));
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
      const ids = api.createOrientationSeries.mock.calls.map((c) => c[0].seriesId);
      expect(new Set(ids).size).toBe(1);
    });

    it("mostra que as turmas já tinham sido criadas", async () => {
      api.createOrientationSeries.mockImplementation(async (input: { dryRun: boolean }) =>
        input.dryRun
          ? { seriesId: null, sessions: dates }
          : { seriesId: "x", sessions: dates, alreadyCreated: true },
      );
      vi.useRealTimers();
      await openPreview();
      fireEvent.click(screen.getByRole("button", { name: "Criar 10 turmas" }));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Estas turmas já tinham sido criadas."));
    });

    it("mudar o plano gera outro seriesId", async () => {
      api.createOrientationSeries.mockResolvedValue({ seriesId: null, sessions: dates });
      vi.useRealTimers();
      await openPreview();
      fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
      fireEvent.change(screen.getByLabelText("Horário"), { target: { value: "10:00" } });
      fireEvent.click(screen.getByRole("button", { name: "Ver as datas" }));
      await waitFor(() => expect(api.createOrientationSeries).toHaveBeenCalledTimes(2));
      const [a, b] = api.createOrientationSeries.mock.calls.map((c) => c[0].seriesId);
      expect(a).not.toBe(b);
    });
  });

  it("cancelar série pede a conta e confirma com dryRun false", async () => {
    api.listOrientationSessions.mockResolvedValue([makeSession({ seriesId: "ser-1" })]);
    api.cancelOrientationSeries.mockImplementation(async (_id: string, o: { dryRun: boolean }) =>
      o.dryRun ? { sessions: 6, cancelledEnrollments: 14 } : { sessions: 6, cancelledEnrollments: 14 },
    );
    renderPage();
    await screen.findAllByText("7/10");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar série" }));
    const confirm = await screen.findByRole("button", { name: "Cancelar 6 turmas futuras (14 inscritos)" });
    expect(api.cancelOrientationSeries).toHaveBeenCalledWith("ser-1", { dryRun: true });
    fireEvent.click(confirm);
    await waitFor(() => expect(api.cancelOrientationSeries).toHaveBeenLastCalledWith("ser-1", { dryRun: false }));
  });

  it("cancelar turma explica que ninguém é avisado e lista os inscritos", async () => {
    api.cancelOrientationSession.mockResolvedValue({ cancelledEnrollments: 7 });
    renderPage();
    await screen.findAllByText("7/10");
    fireEvent.click(screen.getAllByRole("button", { name: "Cancelar turma" })[0]);
    expect(
      await screen.findByText(/Ninguém recebe aviso automático por enquanto\. A lista de inscritos continua na página da turma, com o botão do WhatsApp\./),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Julia/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar turma (7 inscritos)" }));
    await waitFor(() => expect(api.cancelOrientationSession).toHaveBeenCalledWith("s1", undefined));
  });

  it("editar com horário novo avisa para chamar os inscritos pelo WhatsApp", async () => {
    api.updateOrientationSession.mockResolvedValue({ ...makeSession(), scheduleChanged: true });
    renderPage();
    await screen.findAllByText("7/10");
    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Horário"), { target: { value: "10:00" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(
      await screen.findByText("O horário mudou. Avise os 7 inscritos pelo WhatsApp: a lista está na página da turma."),
    ).toBeInTheDocument();
    expect(api.updateOrientationSession).toHaveBeenCalledWith("s1", { startsAt: "2026-11-12T13:00:00.000Z" });
  });

  it("nova turma sem link mostra o erro e não chama a API", async () => {
    renderPage();
    await screen.findAllByText("7/10");
    fireEvent.click(screen.getByRole("button", { name: "Nova turma" }));
    await act(async () => {});
    fireEvent.click(await screen.findByRole("button", { name: "Criar turma" }));
    expect(toast.error).toHaveBeenCalledWith("Cole o link do Meet (https://…).");
    expect(api.createOrientationSession).not.toHaveBeenCalled();
  });
});

import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ granted: ["ORIENTATION"] as string[], isSuperAdmin: false }));
vi.mock("@/modules/auth/application/use-auth", () => ({
  useAuth: () => ({ hasPermission: (k: string) => auth.isSuperAdmin || auth.granted.includes(k), isSuperAdmin: auth.isSuperAdmin }),
}));

const h = vi.hoisted(() => ({
  useOrientationProvider: vi.fn(),
  action: vi.fn(),
  link: vi.fn(),
  sessions: vi.fn(),
  settings: vi.fn(),
}));
vi.mock("@/modules/admin/application/use-orientation", () => ({
  useOrientationProvider: h.useOrientationProvider,
  useOrientationProviderAction: () => ({ mutateAsync: h.action, isPending: false }),
  useBookingLink: () => ({ mutateAsync: h.link, isPending: false }),
  useOrientationSessions: h.sessions,
  useOrientationSettings: h.settings,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { OrientationProviderSection } from "./orientation-provider-section";

const NOW = new Date("2026-11-11T12:00:00.000Z");

function enrollmentRow(over: Record<string, unknown> = {}) {
  return {
    id: "e1",
    sessionId: "s-1",
    status: "BOOKED",
    origin: "APP",
    bookedAt: "2026-11-10T10:00:00.000Z",
    resultAt: null,
    notes: null,
    cancelledReason: null,
    session: { startsAt: "2026-11-16T12:00:00.000Z", endsAt: "2026-11-16T13:00:00.000Z", status: "OPEN" },
    ...over,
  };
}

function detail(over: Record<string, unknown> = {}) {
  return {
    providerGlobalId: "pg-1",
    profile: null,
    status: "PENDING",
    statusAt: "2026-11-01T15:00:00.000Z",
    approvedVia: null,
    noShows: 0,
    changes: 0,
    current: null,
    enrollments: [],
    events: [],
    ...over,
  };
}

function session(id: string, startsAt: string, over: Record<string, unknown> = {}) {
  return {
    id,
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 3600_000).toISOString(),
    capacity: 10,
    bookedCount: 7,
    status: "OPEN",
    ...over,
  };
}

function setup(data: unknown, props: Partial<Parameters<typeof OrientationProviderSection>[0]> = {}) {
  h.useOrientationProvider.mockReturnValue({ data, isLoading: false, isError: false });
  return render(<OrientationProviderSection providerGlobalId="pg-1" listStatus="PENDING" {...props} />);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  auth.granted = ["FREELANCERS", "ORIENTATION"];
  auth.isSuperAdmin = false;
  Object.values(h).forEach((f) => f.mockReset());
  toast.success.mockReset();
  toast.error.mockReset();
  h.action.mockResolvedValue({});
  h.settings.mockReturnValue({ data: { bookingClosesMinBefore: 120 } });
  h.sessions.mockReturnValue({
    data: [
      session("s-1", "2026-11-16T12:00:00.000Z"),
      session("s-2", "2026-11-17T12:00:00.000Z"),
      session("s-full", "2026-11-18T12:00:00.000Z", { bookedCount: 10 }),
      session("s-closed", "2026-11-11T13:00:00.000Z"),
      session("s-cancelled", "2026-11-19T12:00:00.000Z", { status: "CANCELLED" }),
    ],
    isLoading: false,
  });
});

describe("OrientationProviderSection", () => {
  it("sem ORIENTATION: só o selo e o aviso, sem buscar o detalhe", () => {
    auth.granted = ["FREELANCERS"];
    h.useOrientationProvider.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    render(<OrientationProviderSection providerGlobalId="pg-1" listStatus="APPROVED" />);
    expect(screen.getByText("Aprovado")).toBeInTheDocument();
    expect(screen.getByText("Você não tem acesso ao Onboarding.")).toBeInTheDocument();
    expect(h.useOrientationProvider).toHaveBeenCalledWith("pg-1", false);
  });

  it("sem identidade global: avisa e não oferece ações", () => {
    h.useOrientationProvider.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    render(<OrientationProviderSection providerGlobalId={null} listStatus={null} />);
    expect(
      screen.getByText("Este cadastro não tem identidade global (cadastro antigo). Não dá para agendar aula por aqui."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agendar por ele" })).not.toBeInTheDocument();
  });

  it("PENDING sem aula, admin comum: agendar e copiar link, sem aprovar sem aula", () => {
    setup(detail());
    expect(screen.getByRole("button", { name: "Agendar por ele" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar link de agendamento" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprovar sem aula" })).not.toBeInTheDocument();
  });

  it("super-admin vê Aprovar sem aula e o motivo é obrigatório", async () => {
    auth.isSuperAdmin = true;
    setup(detail());
    fireEvent.click(screen.getByRole("button", { name: "Aprovar sem aula" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  veio indicado  " } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Aprovar sem aula" }));
    });
    expect(h.action).toHaveBeenCalledWith({ kind: "approve-manual", providerGlobalId: "pg-1", reason: "veio indicado" });
    expect(toast.success).toHaveBeenCalled();
  });

  it("Agendar por ele lista só turmas abertas, com lugar e inscrição aberta, e manda book", async () => {
    setup(detail());
    fireEvent.click(screen.getByRole("button", { name: "Agendar por ele" }));
    expect(screen.getAllByText(/faltam 3 lugares/)).toHaveLength(2);
    expect(screen.queryByText(/quarta, 18\/11/)).not.toBeInTheDocument(); // lotada
    expect(screen.queryByText(/quarta, 11\/11/)).not.toBeInTheDocument(); // inscrição fechada
    expect(screen.queryByText(/quinta, 19\/11/)).not.toBeInTheDocument(); // cancelada
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /terça, 17\/11/ }));
    });
    expect(h.action).toHaveBeenCalledWith({ kind: "book", providerGlobalId: "pg-1", sessionId: "s-2" });
  });

  it("com aula marcada: mostra o horário; trocar manda reschedule sem a turma atual; desmarcar manda cancel-booking", async () => {
    setup(detail({ current: enrollmentRow() }));
    expect(screen.getByText(/Aula marcada: segunda, 16\/11 · 9h/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trocar turma" }));
    expect(screen.queryByRole("button", { name: /segunda, 16\/11/ })).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /terça, 17\/11/ }));
    });
    expect(h.action).toHaveBeenCalledWith({ kind: "reschedule", providerGlobalId: "pg-1", sessionId: "s-2" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Desmarcar aula" }));
    });
    expect(h.action).toHaveBeenCalledWith({ kind: "cancel-booking", providerGlobalId: "pg-1" });
  });

  it("APPROVED: Corrigir resultado pede motivo", async () => {
    setup(detail({ status: "APPROVED", approvedVia: "CLASS" }), { listStatus: "APPROVED" });
    expect(screen.getByText(/Fez a aula/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Corrigir resultado" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "chamada errada" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Corrigir resultado" }));
    });
    expect(h.action).toHaveBeenCalledWith({ kind: "correct-result", providerGlobalId: "pg-1", reason: "chamada errada" });
  });

  it("REJECTED: Permitir nova aula", async () => {
    setup(detail({ status: "REJECTED" }), { listStatus: "REJECTED" });
    fireEvent.click(screen.getByRole("button", { name: "Permitir nova aula" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "reavaliado" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Permitir nova aula" }));
    });
    expect(h.action).toHaveBeenCalledWith({ kind: "allow-new-class", providerGlobalId: "pg-1", reason: "reavaliado" });
  });

  it("zerar faltas e trocas só com contagem > 0", async () => {
    setup(detail({ noShows: 2, changes: 0 }));
    expect(screen.getByText("Faltas: 2 · Trocas nesta rodada: 0")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Zerar trocas/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zerar faltas (2)" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "justificou" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Zerar faltas" }));
    });
    expect(h.action).toHaveBeenCalledWith({ kind: "reset-no-shows", providerGlobalId: "pg-1", reason: "justificou" });
  });

  it("zerar trocas manda reset-changes", async () => {
    setup(detail({ noShows: 0, changes: 3 }));
    fireEvent.click(screen.getByRole("button", { name: "Zerar trocas (3)" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "erro do sistema" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Zerar trocas" }));
    });
    expect(h.action).toHaveBeenCalledWith({ kind: "reset-changes", providerGlobalId: "pg-1", reason: "erro do sistema" });
  });

  it("erro da ação mostra o texto da tabela", async () => {
    h.action.mockRejectedValue(
      new AxiosError("x", "409", undefined, undefined, {
        status: 409,
        statusText: "",
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { error: { code: "SESSION_FULL", message: "cheia" } },
      }),
    );
    setup(detail());
    fireEvent.click(screen.getByRole("button", { name: "Agendar por ele" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /terça, 17\/11/ }));
    });
    expect(toast.error).toHaveBeenCalledWith("Esta turma lotou. Escolha outra.");
  });

  describe("copiar link", () => {
    it("copia e avisa a validade", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      h.link.mockResolvedValue({ url: "https://freela.example/aula?t=abc", expiresAt: "2026-12-11T15:00:00.000Z" });
      setup(detail());
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copiar link de agendamento" }));
      });
      expect(writeText).toHaveBeenCalledWith("https://freela.example/aula?t=abc");
      expect(toast.success).toHaveBeenCalledWith("Link copiado. Vale até 11/12/2026.");
    });

    it("links desligados no servidor: texto da tabela de erros", async () => {
      h.link.mockRejectedValue(
        new AxiosError("x", "503", undefined, undefined, {
          status: 503,
          statusText: "",
          headers: {},
          config: { headers: new AxiosHeaders() },
          data: { error: { code: "ORIENTATION_LINKS_NOT_CONFIGURED", message: "off" } },
        }),
      );
      setup(detail());
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copiar link de agendamento" }));
      });
      expect(toast.error).toHaveBeenCalledWith(
        'Os links de agendamento ainda não estão ligados no servidor. Use "Agendar por ele" e mande o link do Meet.',
      );
    });

    it("sem área de transferência: mostra o link num campo só de leitura", async () => {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
      h.link.mockResolvedValue({ url: "https://freela.example/aula?t=abc", expiresAt: "2026-12-11T15:00:00.000Z" });
      setup(detail());
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copiar link de agendamento" }));
      });
      const field = await screen.findByDisplayValue("https://freela.example/aula?t=abc");
      expect(field).toHaveAttribute("readonly");
    });
  });

  it("histórico: inscrições e eventos com quem fez", async () => {
    setup(
      detail({
        enrollments: [
          enrollmentRow({ id: "e0", status: "NO_SHOW", notes: "não entrou", session: { startsAt: "2026-11-09T12:00:00.000Z", endsAt: "2026-11-09T13:00:00.000Z", status: "FINISHED" } }),
          enrollmentRow({ id: "e1", status: "CANCELLED", cancelledReason: "SESSION_CANCELLED" }),
        ],
        events: [
          { id: "v1", action: "booked", actorType: "ADMIN", actorId: "a1", actorName: "Rebeca", detail: null, createdAt: "2026-11-10T13:30:00.000Z" },
          { id: "v2", action: "no_show_reset", actorType: "FREELANCER", actorId: null, detail: null, createdAt: "2026-11-10T14:00:00.000Z" },
          { id: "v3", action: "result_set", actorType: "SYSTEM", actorId: null, detail: null, createdAt: "2026-11-10T15:00:00.000Z" },
        ],
      }),
    );
    const toggle = screen.getByRole("button", { name: "Ver histórico (5)" });
    fireEvent.click(toggle);
    const hist = screen.getByTestId("orientation-history");
    expect(within(hist).getByText(/Faltou/)).toBeInTheDocument();
    expect(within(hist).getByText(/não entrou/)).toBeInTheDocument();
    expect(within(hist).getByText(/Turma cancelada/)).toBeInTheDocument();
    expect(within(hist).getByText(/Marcou a aula/)).toBeInTheDocument();
    expect(within(hist).getByText(/Rebeca/)).toBeInTheDocument();
    expect(within(hist).getByText(/Freelancer/)).toBeInTheDocument();
    expect(within(hist).getByText(/Sistema/)).toBeInTheDocument();
    await waitFor(() => expect(within(hist).getByText(/10\/11\/2026, 10h30/)).toBeInTheDocument());
  });

  it("sem histórico: não mostra o botão", () => {
    setup(detail());
    expect(screen.queryByRole("button", { name: /Ver histórico/ })).not.toBeInTheDocument();
  });
});

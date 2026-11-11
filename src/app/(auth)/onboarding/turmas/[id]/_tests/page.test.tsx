import "@testing-library/jest-dom";
import { AxiosError, AxiosHeaders } from "axios";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getOrientationSession: vi.fn(),
  getOrientationSettings: vi.fn(),
  previewAttendance: vi.fn(),
  finishAttendance: vi.fn(),
  reopenAttendance: vi.fn(),
  correctOrientationResult: vi.fn(),
  allowNewClass: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/orientation-api", async (orig) => ({ ...(await orig<object>()), ...api }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const auth = vi.hoisted(() => ({ jobs: true }));
vi.mock("@/modules/auth/application/use-auth", () => ({
  useAuth: () => ({ hasPermission: (p: string) => (p === "JOBS" ? auth.jobs : true) }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "s1" }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import ChamadaPage from "../page";

const DRAFT_KEY = "orientation-attendance:s1";

function enrollee(id: string, name: string, over: Record<string, unknown> = {}) {
  return {
    enrollmentId: id,
    providerGlobalId: `pg-${id}`,
    userId: `u-${id}`,
    status: "BOOKED",
    origin: "APP",
    bookedAt: "2026-11-10T10:00:00.000Z",
    notes: null,
    firstJoinClickAt: null,
    name,
    phone: "11999990000",
    city: "Campinas",
    uf: "SP",
    roles: ["Garçom"],
    totalCompletedServices: 0,
    previousNoShows: 2,
    ...over,
  };
}

function detail(over: Record<string, unknown> = {}) {
  return {
    id: "s1",
    startsAt: "2026-11-16T12:00:00.000Z",
    endsAt: "2026-11-16T13:00:00.000Z",
    capacity: 10,
    bookedCount: 3,
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
    enrollees: [enrollee("e1", "Ana"), enrollee("e2", "Bruno"), enrollee("e3", "Carla")],
    reopenUntil: null,
    ...over,
  };
}

function apiError(code: string, status = 409) {
  return new AxiosError("x", "ERR", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code, message: "msg crua da API" } },
  });
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ChamadaPage />
    </QueryClientProvider>,
  );
}

const rowOf = (name: string) => screen.getByRole("listitem", { name: new RegExp(`^${name}\\.`) });
const mark = (name: string, label: string) =>
  fireEvent.click(within(rowOf(name)).getByRole("button", { name: label }));

describe("Chamada da turma", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.jobs = true;
    sessionStorage.clear();
    // 16/11 12:30Z = 9h30 em Brasília: a aula já começou.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-16T12:30:00Z") });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    api.getOrientationSession.mockResolvedValue(detail());
    api.getOrientationSettings.mockResolvedValue({ resultGraceMin: 10 });
    api.previewAttendance.mockResolvedValue({ warnings: [] });
    api.finishAttendance.mockResolvedValue({ approved: 1, rejected: 1, noShow: 1, unchanged: [] });
  });
  afterEach(() => vi.useRealTimers());

  it("mostra cabeçalho e uma linha por inscrito, por nome", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: /segunda, 16\/11, 9h às 10h/ })).toBeInTheDocument();
    expect(screen.getByText("Rebeca")).toBeInTheDocument();
    expect(screen.getByText("3/10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar link do Meet" })).toBeInTheDocument();
    const names = screen.getAllByRole("listitem").map((li) => li.getAttribute("aria-label")?.split(".")[0]);
    expect(names).toEqual(["Ana", "Bruno", "Carla"]);
    expect(screen.getAllByText("Faltas anteriores:")).toHaveLength(3);
    expect(screen.getAllByText("Não tocou em Entrar")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Aprovar quem tocou em Entrar (0)" })).toBeDisabled();
    expect(screen.queryByText(/aprovar todos/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /WhatsApp/ })[0]).toHaveAttribute("href", "https://wa.me/5511999990000");
  });

  it("restaura o rascunho e apaga depois de encerrar", async () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ e1: { result: "APPROVED", notes: "" } }));
    renderPage();
    await screen.findByText("Ana");
    expect(within(rowOf("Ana")).getByRole("button", { name: "Aprovado" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1/3 marcados")).toBeInTheDocument();

    mark("Bruno", "Faltou");
    mark("Carla", "Faltou");
    expect(JSON.parse(sessionStorage.getItem(DRAFT_KEY) as string).e2.result).toBe("NO_SHOW");
    fireEvent.click(screen.getByRole("button", { name: "Encerrar chamada" }));
    fireEvent.click(await screen.findByRole("button", { name: "Encerrar agora" }));
    await waitFor(() => expect(api.finishAttendance).toHaveBeenCalled());
    await waitFor(() => expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull());
  });

  it("atalhos: a aprova e desce, r reprova e vai para a anotação, texto na anotação não marca", async () => {
    renderPage();
    await screen.findByText("Ana");
    rowOf("Ana").focus();
    fireEvent.keyDown(rowOf("Ana"), { key: "a" });
    expect(within(rowOf("Ana")).getByRole("button", { name: "Aprovado" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(rowOf("Bruno")).toHaveFocus());

    fireEvent.keyDown(rowOf("Bruno"), { key: "r" });
    expect(within(rowOf("Bruno")).getByRole("button", { name: "Reprovado" })).toHaveAttribute("aria-pressed", "true");
    const note = within(rowOf("Bruno")).getByRole("textbox");
    await waitFor(() => expect(note).toHaveFocus());

    fireEvent.keyDown(note, { key: "f" });
    expect(within(rowOf("Bruno")).getByRole("button", { name: "Reprovado" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(rowOf("Carla"), { key: "f", ctrlKey: true });
    expect(within(rowOf("Carla")).getByRole("button", { name: "Faltou" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.keyDown(rowOf("Carla"), { key: "F" });
    expect(within(rowOf("Carla")).getByRole("button", { name: "Faltou" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Reprovado consulta a API e avisa de vaga aceita com link", async () => {
    api.previewAttendance.mockResolvedValue({
      warnings: [
        {
          enrollmentId: "e2",
          futureAcceptedVacancies: [
            {
              vacancyId: "vac-1",
              startTime: "2026-11-17T22:00:00.000Z",
              title: "Garçom",
              contractorName: "Coco Bambu Jundiaí",
            },
          ],
        },
      ],
    });
    renderPage();
    await screen.findByText("Bruno");
    mark("Bruno", "Reprovado");
    await waitFor(() =>
      expect(api.previewAttendance).toHaveBeenCalledWith("s1", [{ enrollmentId: "e2", result: "REJECTED" }]),
    );
    const warn = await screen.findByText(
      (_, el) =>
        el?.tagName === "SPAN" &&
        el.textContent === "Esta pessoa tem 1 vaga aceita (ter 17/11, 19h · Coco Bambu Jundiaí) — ver",
    );
    const link = within(warn).getByRole("link", { name: "ver" });
    expect(link).toHaveAttribute("href", "/jobs?vaga=vac-1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("sem permissão de Vagas o aviso não vira link", async () => {
    auth.jobs = false;
    api.previewAttendance.mockResolvedValue({
      warnings: [
        {
          enrollmentId: "e2",
          futureAcceptedVacancies: [{ vacancyId: "vac-1", startTime: "2026-11-17T22:00:00.000Z", contractorName: "Coco Bambu Jundiaí" }],
        },
      ],
    });
    renderPage();
    await screen.findByText("Bruno");
    mark("Bruno", "Reprovado");
    await screen.findByText(/Esta pessoa tem 1 vaga aceita/);
    expect(screen.queryByRole("link", { name: "ver" })).not.toBeInTheDocument();
  });

  it("detalhe que volta encerrado apaga o rascunho", async () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ e1: { result: "APPROVED", notes: "" } }));
    api.getOrientationSession.mockResolvedValue(detail({ status: "FINISHED" }));
    renderPage();
    await screen.findByRole("heading", { name: /segunda, 16\/11/ });
    await waitFor(() => expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull());
  });

  it("encerrar fica bloqueado até marcar todos, anotar o reprovado e a aula começar", async () => {
    renderPage();
    await screen.findByText("Ana");
    const btn = screen.getByRole("button", { name: "Encerrar chamada" });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/Faltam 3 pessoas/)).toBeInTheDocument();
    mark("Ana", "Aprovado");
    mark("Bruno", "Reprovado");
    mark("Carla", "Faltou");
    expect(btn).toBeDisabled();
    expect(screen.getByText(/Reprovado sem anotação: Bruno/)).toBeInTheDocument();
    fireEvent.change(within(rowOf("Bruno")).getByRole("textbox"), { target: { value: " saiu cedo " } });
    expect(btn).toBeEnabled();
    await waitFor(() => expect(api.previewAttendance).toHaveBeenCalled());
    await act(async () => {});
  });

  it("dois reprovados antes da 1ª consulta voltar: os dois avisos aparecem", async () => {
    const vac = (id: string, name: string) => ({
      vacancyId: id,
      startTime: "2026-11-17T22:00:00.000Z",
      title: "Garçom",
      contractorName: name,
    });
    let resolveFirst: (v: unknown) => void = () => {};
    api.previewAttendance
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce({ warnings: [{ enrollmentId: "e2", futureAcceptedVacancies: [vac("vac-2", "Madero")] }] });
    renderPage();
    await screen.findByText("Ana");
    mark("Ana", "Reprovado");
    await waitFor(() => expect(api.previewAttendance).toHaveBeenCalledTimes(1));
    mark("Bruno", "Reprovado");
    await waitFor(() => expect(api.previewAttendance).toHaveBeenCalledTimes(2));
    await act(async () => {
      resolveFirst({ warnings: [{ enrollmentId: "e1", futureAcceptedVacancies: [vac("vac-1", "Coco Bambu")] }] });
    });
    expect(await screen.findByText(/Coco Bambu\)/)).toBeInTheDocument();
    expect(await screen.findByText(/Madero\)/)).toBeInTheDocument();
  });

  it("diálogo mostra o resumo, manda o payload e avisa de quem não mudou", async () => {
    api.finishAttendance.mockResolvedValue({
      approved: 1,
      rejected: 1,
      noShow: 1,
      unchanged: [{ enrollmentId: "e3", providerStatus: "APPROVED" }],
    });
    renderPage();
    await screen.findByText("Ana");
    mark("Ana", "Aprovado");
    mark("Bruno", "Reprovado");
    fireEvent.change(within(rowOf("Bruno")).getByRole("textbox"), { target: { value: " saiu cedo " } });
    mark("Carla", "Faltou");
    fireEvent.click(screen.getByRole("button", { name: "Encerrar chamada" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).toContain("max-h-[55vh]");
    expect(dialog.className).toContain("overflow-y-auto");
    expect(
      within(dialog).getByText("Encerrar chamada de segunda, 16/11, 9h: 1 aprovado, 1 não aprovado, 1 faltou."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Os resultados ficam registrados na hora. Dá para reabrir a chamada por 10 minutos. Por enquanto ninguém perde vagas.",
      ),
    ).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/mensagens saem/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Encerrar agora" }));
    await waitFor(() =>
      expect(api.finishAttendance).toHaveBeenCalledWith("s1", [
        { enrollmentId: "e1", result: "APPROVED" },
        { enrollmentId: "e2", result: "REJECTED", notes: "saiu cedo" },
        { enrollmentId: "e3", result: "NO_SHOW" },
      ]),
    );
    expect(
      await screen.findByText("1 pessoa já estava aprovada ou reprovada por outro caminho; a situação dela não mudou."),
    ).toBeInTheDocument();
  });

  it("lista mudou: recarrega, tira só a marca de quem saiu, mantém as outras e explica", async () => {
    api.finishAttendance.mockRejectedValue(apiError("ATTENDANCE_CHANGED"));
    renderPage();
    await screen.findByText("Ana");
    mark("Ana", "Aprovado");
    mark("Bruno", "Faltou");
    mark("Carla", "Faltou");
    api.getOrientationSession.mockResolvedValue(
      detail({ enrollees: [enrollee("e1", "Ana"), enrollee("e2", "Bruno", { status: "CANCELLED" }), enrollee("e3", "Carla")] }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Encerrar chamada" }));
    fireEvent.click(await screen.findByRole("button", { name: "Encerrar agora" }));
    expect(
      await screen.findByText(
        "A lista da turma mudou enquanto você marcava. Atualizamos a lista: confira e encerre de novo.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Bruno")).not.toBeInTheDocument());
    expect(within(rowOf("Ana")).getByRole("button", { name: "Aprovado" })).toHaveAttribute("aria-pressed", "true");
    expect(within(rowOf("Carla")).getByRole("button", { name: "Faltou" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("2/2 marcados")).toBeInTheDocument();
    expect(Object.keys(JSON.parse(sessionStorage.getItem(DRAFT_KEY) as string))).toEqual(["e1", "e3"]);
  });

  describe("depois de encerrada", () => {
    const finished = (over: Record<string, unknown> = {}) =>
      detail({
        status: "FINISHED",
        enrollees: [
          enrollee("e1", "Ana", { status: "APPROVED" }),
          enrollee("e2", "Bruno", { status: "REJECTED", notes: "saiu cedo" }),
          enrollee("e3", "Carla", { status: "NO_SHOW" }),
        ],
        ...over,
      });

    it("dentro do prazo, mostra Reabrir com a hora", async () => {
      api.getOrientationSession.mockResolvedValue(finished({ reopenUntil: "2026-11-16T12:42:00.000Z" }));
      api.reopenAttendance.mockResolvedValue({ reopened: true });
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Reabrir chamada (até 9h42)" }));
      await waitFor(() => expect(api.reopenAttendance).toHaveBeenCalledWith("s1"));
      expect(screen.queryByRole("button", { name: /Corrigir resultado/ })).not.toBeInTheDocument();
    });

    it("sem prazo, corrige aprovado e permite nova aula do reprovado pedindo motivo", async () => {
      api.getOrientationSession.mockResolvedValue(finished());
      api.correctOrientationResult.mockResolvedValue({ ok: true });
      api.allowNewClass.mockResolvedValue({ ok: true });
      renderPage();
      expect(screen.queryByRole("button", { name: /Reabrir chamada/ })).not.toBeInTheDocument();
      fireEvent.click(await screen.findByRole("button", { name: /Corrigir resultado/ }));
      const dialog = await screen.findByRole("dialog");
      expect(dialog.className).toContain("max-h-[55vh]");
      const confirm = within(dialog).getAllByRole("button", { name: "Corrigir resultado" }).pop() as HTMLElement;
      expect(confirm).toBeDisabled();
      fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "marquei errado" } });
      fireEvent.click(confirm);
      await waitFor(() => expect(api.correctOrientationResult).toHaveBeenCalledWith("pg-e1", "marquei errado"));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: /Permitir nova aula/ }));
      const d2 = await screen.findByRole("dialog");
      fireEvent.change(within(d2).getByRole("textbox"), { target: { value: "pediu outra chance" } });
      fireEvent.click(within(d2).getAllByRole("button", { name: "Permitir nova aula" }).pop() as HTMLElement);
      await waitFor(() => expect(api.allowNewClass).toHaveBeenCalledWith("pg-e2", "pediu outra chance"));
    });
  });

  it("turma cancelada mostra quando e por quê, e quem avisar, com WhatsApp", async () => {
    api.getOrientationSession.mockResolvedValue(
      detail({
        status: "CANCELLED",
        cancelledAt: "2026-11-15T15:00:00.000Z",
        cancelReason: "Sem professor",
        enrollees: [
          enrollee("e1", "Ana", { status: "CANCELLED", cancelledReason: "SESSION_CANCELLED" }),
          enrollee("e2", "Bruno", { status: "CANCELLED", cancelledReason: "BY_FREELANCER" }),
        ],
      }),
    );
    renderPage();
    expect(await screen.findByText(/Turma cancelada em dom 15\/11, 12h: Sem professor/)).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.queryByText("Bruno")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", "https://wa.me/5511999990000");
    expect(screen.queryByRole("button", { name: "Encerrar chamada" })).not.toBeInTheDocument();
  });

  it("erro ao carregar oferece tentar de novo", async () => {
    api.getOrientationSession.mockRejectedValueOnce(apiError("NOT_FOUND", 404));
    renderPage();
    expect(await screen.findByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    await act(async () => {});
  });
});

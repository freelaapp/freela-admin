import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getOrientationQueue: vi.fn(),
  getOrientationQueueCounters: vi.fn(),
  getOrientationQueuePeople: vi.fn(),
  exportOrientationQueue: vi.fn(),
  previewConvocation: vi.fn(),
  createConvocation: vi.fn(),
  listConvocations: vi.fn(),
  getOrientationSettings: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/orientation-api", async (orig) => ({ ...(await orig<object>()), ...api }));
const catalog = vi.hoisted(() => ({ getCatalogRoles: vi.fn(async () => []) }));
vi.mock("@/modules/admin/infrastructure/catalog-api", async (orig) => ({ ...(await orig<object>()), ...catalog }));
vi.mock("@/lib/csv", () => ({ downloadCsv: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const nav = vi.hoisted(() => ({ search: "uf=SP&cidade=Campinas" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/onboarding/fila",
}));

vi.mock("@/modules/auth/application/use-auth", () => ({ useAuth: () => ({ isSuperAdmin: false }) }));

import FilaPage from "../page";

function row(i: number, over: Record<string, unknown> = {}) {
  return {
    providerGlobalId: `pg${i}`,
    userId: `u${i}`,
    name: `Pessoa ${i}`,
    phone: "11999990000",
    city: "Campinas",
    uf: "SP",
    roles: ["Garçom"],
    signedUpAt: "2026-10-10T15:00:00.000Z",
    totalCompletedServices: 3,
    lastActiveDay: "2026-11-09",
    noShows: 0,
    lastConvokedAt: null,
    notifyRequestedAt: null,
    status: "PENDING",
    ...over,
  };
}
const preview = (over: Record<string, unknown> = {}, plan: Record<string, unknown> = {}) => ({
  people: 40,
  matching: 40,
  withoutGlobal: 0,
  places: [{ uf: "SP", city: "Campinas", count: 40 }],
  freeSeats14d: 20,
  plan: { days: 1, perSeat: 2, blocked: null, overbooked: false, requiresTypedCount: false, ...plan },
  pendingInQueue: 0,
  dailyCap: 300,
  channels: { messagesEnabled: true, whatsapp: true, push: true },
  ...over,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FilaPage />
    </QueryClientProvider>,
  );
}
async function openFiltered() {
  await screen.findAllByText("Pessoa 1");
  fireEvent.click(screen.getByRole("button", { name: "Convocar o grupo filtrado" }));
  return await screen.findByRole("dialog");
}
const sendBtn = (d: HTMLElement) => within(d).getByRole("button", { name: /^Convocar/ });

describe("Convocar da Fila", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "uf=SP&cidade=Campinas";
    api.getOrientationQueueCounters.mockResolvedValue({
      counters: {
        pending: { value: 1, active: 1, approved: 0, rejected: 0, booked: 0 },
        pendingActive30: { value: 1, measuredSince: "2026-10-07" },
        freeSeats4w: { value: 80, sessions: 8 },
        weeksToServe: { value: 40, perWeek: 20 },
        approved: { value: 0 },
      },
      measuredSince: "2026-10-07",
    });
    api.getOrientationQueue.mockResolvedValue({ groups: [], groupsTruncated: false });
    api.getOrientationQueuePeople.mockResolvedValue({
      rows: [row(1), row(2), row(3, { providerGlobalId: null })],
      total: 3,
      page: 1,
      pageSize: 30,
    });
    api.previewConvocation.mockResolvedValue(preview());
    api.createConvocation.mockResolvedValue({ convocationId: "c1", queued: 40 });
    api.listConvocations.mockResolvedValue([]);
    api.getOrientationSettings.mockResolvedValue({ convocationMinDays: 7 });
  });

  it("ids de 'sem convite' são únicos entre tabela e cartão", async () => {
    renderPage();
    await screen.findAllByText("Pessoa 1");
    const ids = [...document.querySelectorAll('[id^="sem-convite-"]')].map((e) => e.id);
    expect(ids.length).toBe(2);
    expect(new Set(ids).size).toBe(2);
    for (const cb of screen.getAllByLabelText("Selecionar Pessoa 3")) {
      expect(document.getElementById(cb.getAttribute("aria-describedby") as string)).not.toBeNull();
    }
  });

  it("diálogo: um só papel de dialog, nomeado pelo título", async () => {
    renderPage();
    const d = await openFiltered();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(d).not.toHaveAttribute("aria-label");
    expect(d).toHaveAccessibleName("Convocar para a aula");
  });

  it("grupo filtrado: explica lista, convocáveis e limite", async () => {
    api.previewConvocation.mockResolvedValue(preview({ people: 40, matching: 90 }));
    renderPage();
    const d = await openFiltered();
    await within(d).findByText(
      "3 na lista; 90 podem ser convocadas agora; vai mandar para 40 pessoas de Campinas/SP (limite de 10.000 por convocação).",
    );
  });

  it("Situação diferente de Pendente: os dois botões Convocar ficam desativados com o motivo", async () => {
    nav.search = "uf=SP&situacao=APPROVED";
    renderPage();
    await screen.findAllByText("Pessoa 1");
    expect(screen.getByRole("button", { name: "Convocar o grupo filtrado" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Convocar selecionados (0)" })).toBeDisabled();
    expect(screen.getByText(/Só dá para convocar quem está Pendente/)).toBeInTheDocument();
  });

  it("Convocar selecionados (N): só com seleção; prévia manda a lista com activeWithinDays 0", async () => {
    api.previewConvocation.mockResolvedValue(preview({ people: 1, matching: 1 }));
    renderPage();
    await screen.findAllByText("Pessoa 1");
    expect(screen.getByRole("button", { name: "Convocar selecionados (0)" })).toBeDisabled();
    fireEvent.click(screen.getAllByLabelText("Selecionar Pessoa 1")[0]);
    fireEvent.click(screen.getAllByLabelText("Selecionar Pessoa 2")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Convocar selecionados (2)" }));
    const d = await screen.findByRole("dialog");
    await within(d).findByText(
      "2 selecionadas; 1 fica de fora (convocadas há menos de 7 dias, já na fila de envio ou no limite de faltas); vai mandar para 1 pessoa de Campinas/SP.",
    );
    expect(api.previewConvocation).toHaveBeenCalledWith(
      expect.objectContaining({
        providerGlobalIds: ["pg1", "pg2"],
        filter: expect.objectContaining({ activeWithinDays: 0, uf: "SP", city: "Campinas" }),
      }),
    );
    expect(d.className).toContain("max-h-[55vh]");
    expect(d.className).toContain("overflow-y-auto");
  });

  it("grupo filtrado: usa o campo 'no máximo' como limit", async () => {
    renderPage();
    await screen.findAllByText("Pessoa 1");
    fireEvent.change(screen.getByLabelText(/no máximo/i), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Convocar o grupo filtrado" }));
    const d = await screen.findByRole("dialog");
    await within(d).findByText(/vai mandar para 40 pessoas de Campinas\/SP/i);
    expect(api.previewConvocation).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });

  it("0 lugares: botão desativado e 'Crie turmas para Campinas/SP antes de convocar.'", async () => {
    api.previewConvocation.mockResolvedValue(preview({ freeSeats14d: 0 }, { blocked: "NO_SEATS", perSeat: null }));
    renderPage();
    const d = await openFiltered();
    expect(await within(d).findByText("Crie turmas para Campinas/SP antes de convocar.")).toBeInTheDocument();
    expect(sendBtn(d)).toBeDisabled();
  });

  it("mais de 3 por lugar: aviso", async () => {
    api.previewConvocation.mockResolvedValue(preview({}, { perSeat: 7, overbooked: true }));
    renderPage();
    const d = await openFiltered();
    expect(await within(d).findByText(/Mais de 3 convocados por lugar/)).toBeInTheDocument();
    expect(sendBtn(d)).toBeEnabled();
  });

  it("mensagens desligadas: faixa e botão desativado", async () => {
    api.previewConvocation.mockResolvedValue(
      preview({ channels: { messagesEnabled: false, whatsapp: false, push: true } }),
    );
    renderPage();
    const d = await openFiltered();
    expect(
      await within(d).findByText("As mensagens da aula ainda estão desligadas. A prévia vale, mas nada é enviado."),
    ).toBeInTheDocument();
    expect(sendBtn(d)).toBeDisabled();
  });

  it("WhatsApp da convocação desligado: só aviso no app", async () => {
    api.previewConvocation.mockResolvedValue(
      preview({ channels: { messagesEnabled: true, whatsapp: false, push: true } }),
    );
    renderPage();
    const d = await openFiltered();
    expect(
      await within(d).findByText("Só sai o aviso no app; o WhatsApp entra quando a Meta aprovar o modelo."),
    ).toBeInTheDocument();
    expect(sendBtn(d)).toBeEnabled();
  });

  it("mais de 1.000: só libera depois de digitar o número exato", async () => {
    api.previewConvocation.mockResolvedValue(preview({ people: 1200 }, { requiresTypedCount: true }));
    renderPage();
    const d = await openFiltered();
    const btn = await within(d).findByRole("button", { name: "Convocar 1.200 pessoas" });
    expect(btn).toBeDisabled();
    const field = within(d).getByLabelText(/Digite 1\.200/);
    fireEvent.change(field, { target: { value: "1100" } });
    expect(btn).toBeDisabled();
    fireEvent.change(field, { target: { value: "1.200" } });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    await waitFor(() =>
      expect(api.createConvocation).toHaveBeenCalledWith(expect.objectContaining({ confirmCount: 1200 })),
    );
  });

  it("409 CONVOCATION_COUNT_MISMATCH: atualiza o número e pede para digitar de novo", async () => {
    api.previewConvocation
      .mockResolvedValueOnce(preview({ people: 1200 }, { requiresTypedCount: true }))
      .mockResolvedValue(preview({ people: 1250 }, { requiresTypedCount: true }));
    api.createConvocation.mockRejectedValue(
      new AxiosError("x", "409", undefined, undefined, {
        status: 409,
        data: { code: "CONVOCATION_COUNT_MISMATCH", message: "Digite 1250", people: 1250 },
      } as never),
    );
    renderPage();
    const d = await openFiltered();
    await within(d).findByRole("button", { name: "Convocar 1.200 pessoas" });
    fireEvent.change(within(d).getByLabelText(/Digite 1\.200/), { target: { value: "1200" } });
    fireEvent.click(within(d).getByRole("button", { name: "Convocar 1.200 pessoas" }));
    expect(await within(d).findByRole("button", { name: "Convocar 1.250 pessoas" })).toBeDisabled();
    expect(within(d).getByText(/O número digitado não bate/)).toBeInTheDocument();
    expect(within(d).getByLabelText(/Digite 1\.250/)).toHaveValue("");
  });

  it("MESSAGES_DISABLED (409): explica que não dá para enviar com mensagens desligadas", async () => {
    api.createConvocation.mockRejectedValue(
      new AxiosError("x", "409", undefined, undefined, {
        status: 409,
        data: { code: "MESSAGES_DISABLED", message: "desligados" },
      } as never),
    );
    renderPage();
    const d = await openFiltered();
    fireEvent.click(await within(d).findByRole("button", { name: "Convocar 40 pessoas" }));
    expect(await within(d).findByText(/desligados no servidor/)).toBeInTheDocument();
  });

  it("clique duplo reaproveita a mesma requestKey (e só 1 chamada enquanto envia)", async () => {
    let release: (v: unknown) => void = () => {};
    api.createConvocation.mockReturnValue(new Promise((r) => (release = r)));
    renderPage();
    const d = await openFiltered();
    const btn = await within(d).findByRole("button", { name: "Convocar 40 pessoas" });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(api.createConvocation).toHaveBeenCalledTimes(1));
    expect(btn).toBeDisabled();
    release({ convocationId: "c1", queued: 40 });
    await within(d).findByText("40 pessoas na fila de envio");
    expect(typeof api.createConvocation.mock.calls[0][0].requestKey).toBe("string");
    expect(api.createConvocation.mock.calls[0][0].requestKey.length).toBeGreaterThanOrEqual(8);
  });

  it("mudar o filtro na URL com o diálogo aberto não muda o corpo do envio", async () => {
    const view = renderPage();
    const d = await openFiltered();
    const btn = await within(d).findByRole("button", { name: "Convocar 40 pessoas" });
    nav.search = "uf=RJ&cidade=Niteroi";
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <FilaPage />
      </QueryClientProvider>,
    );
    fireEvent.click(btn);
    await waitFor(() => expect(api.createConvocation).toHaveBeenCalled());
    expect(api.createConvocation.mock.calls[0][0].filter).toEqual(expect.objectContaining({ uf: "SP", city: "Campinas" }));
  });

  it("prévia falhou: botão Tentar de novo refaz a prévia", async () => {
    api.previewConvocation.mockRejectedValueOnce(new Error("x"));
    renderPage();
    const d = await openFiltered();
    fireEvent.click(await within(d).findByRole("button", { name: "Tentar de novo" }));
    expect(await within(d).findByText(/vai mandar para 40 pessoas/i)).toBeInTheDocument();
  });

  it("sucesso: '1.200 pessoas na fila de envio' e a lista mostra enviadas / na fila / puladas com a conta", async () => {
    api.previewConvocation.mockResolvedValue(preview({ people: 1200 }, { requiresTypedCount: true }));
    api.createConvocation.mockResolvedValue({ convocationId: "c1", queued: 1200 });
    api.listConvocations.mockResolvedValue([
      {
        id: "c1",
        kind: "ADMIN",
        createdAt: "2026-11-11T15:00:00.000Z",
        requestedByName: "Diego",
        requestedCount: 1200,
        queued: 1200,
        sent: 800,
        skipped: 40,
        pending: 350,
        parked: 10,
      },
    ]);
    renderPage();
    const d = await openFiltered();
    fireEvent.change(await within(d).findByLabelText(/Digite 1\.200/), { target: { value: "1200" } });
    fireEvent.click(within(d).getByRole("button", { name: "Convocar 1.200 pessoas" }));
    expect(await within(d).findByText("1.200 pessoas na fila de envio")).toBeInTheDocument();
    const list = await screen.findByRole("region", { name: "Convocações recentes" });
    expect(within(list).getByText(/Enviadas: 800/)).toBeInTheDocument();
    expect(within(list).getByText(/Na fila: 350/)).toBeInTheDocument();
    expect(within(list).getByText(/Puladas: 40/)).toBeInTheDocument();
    expect(within(list).getByText(/1\.200 na lista = 800 enviadas \+ 350 na fila \+ 40 puladas \+ 10 a conferir/)).toBeInTheDocument();
    expect(within(list).queryByText(/pedidas|ficaram de fora/)).not.toBeInTheDocument();
  });
});

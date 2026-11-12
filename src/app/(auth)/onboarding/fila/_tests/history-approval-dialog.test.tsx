import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getOrientationQueue: vi.fn(),
  getOrientationQueueCounters: vi.fn(),
  getOrientationQueuePeople: vi.fn(),
  listConvocations: vi.fn(),
  getOrientationSettings: vi.fn(),
  previewHistoryApproval: vi.fn(),
  applyHistoryApproval: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/orientation-api", async (orig) => ({ ...(await orig<object>()), ...api }));
vi.mock("@/modules/admin/infrastructure/catalog-api", async (orig) => ({
  ...(await orig<object>()),
  getCatalogRoles: vi.fn(async () => []),
}));
vi.mock("@/lib/csv", () => ({ downloadCsv: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/onboarding/fila",
}));
const auth = vi.hoisted(() => ({ isSuperAdmin: true }));
vi.mock("@/modules/auth/application/use-auth", () => ({ useAuth: () => auth }));

import FilaPage from "../page";

const counters = {
  counters: {
    pending: { value: 1200, active: 3000, approved: 1500, rejected: 100, booked: 200 },
    pendingActive30: { value: 800, measuredSince: "2026-10-07" },
    freeSeats4w: { value: 80, sessions: 8 },
    weeksToServe: { value: 40, perWeek: 20 },
    approved: { value: 1500 },
  },
};
const preview = (over: Record<string, unknown> = {}) => ({
  eligible: 158,
  withBooking: 3,
  noRatings: 40,
  lowRating: 12,
  alreadyApproved: 900,
  rejected: 5,
  sample: [
    { providerGlobalId: "pg1", name: "Ana Souza", city: "Campinas", uf: "SP", totalCompletedServices: 5, averageRating: 4.8 },
  ],
  formula: "f",
  formulas: { eligible: "e", withBooking: "b", noRatings: "n", lowRating: "l", alreadyApproved: "a", rejected: "r" },
  source: "shared.provider_globals (total_completed_services, average_rating, total_ratings) + shared.users ativos",
  ...over,
});

function apiError(status: number, body: Record<string, unknown>) {
  const err = new AxiosError("fail");
  err.response = { status, data: body } as AxiosError["response"];
  return err;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const spy = vi.spyOn(qc, "invalidateQueries");
  render(
    <QueryClientProvider client={qc}>
      <FilaPage />
    </QueryClientProvider>,
  );
  return { spy };
}
async function openDialog() {
  fireEvent.click(await screen.findByRole("button", { name: "Aprovar por histórico" }));
  return await screen.findByRole("dialog");
}
const seeHowMany = (d: HTMLElement) => fireEvent.click(within(d).getByRole("button", { name: "Ver quantos" }));
const approveBtn = (d: HTMLElement) => within(d).queryByRole("button", { name: /^Aprovar \d/ });

describe("Aprovar por histórico (Fila)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.isSuperAdmin = true;
    api.getOrientationQueueCounters.mockResolvedValue(counters);
    api.getOrientationQueue.mockResolvedValue({ groups: [], groupsTruncated: false });
    api.getOrientationQueuePeople.mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 50 });
    api.listConvocations.mockResolvedValue([]);
    api.getOrientationSettings.mockResolvedValue({ convocationMinDays: 7 });
    api.previewHistoryApproval.mockResolvedValue(preview());
    api.applyHistoryApproval.mockResolvedValue({ batchId: "b1", approved: 158, skipped: 0 });
  });

  it("ADMIN comum não vê o botão; SUPER_ADMIN vê", async () => {
    auth.isSuperAdmin = false;
    renderPage();
    await screen.findByRole("heading", { name: "Fila" });
    expect(screen.queryByRole("button", { name: "Aprovar por histórico" })).not.toBeInTheDocument();
  });

  it("SUPER_ADMIN vê o botão e o diálogo cabe na tela (max-h-[55vh], rolagem)", async () => {
    renderPage();
    const d = await openDialog();
    expect(d.className).toContain("max-h-[55vh]");
    expect(d.className).toContain("overflow-y-auto");
    expect(within(d).getByLabelText("Serviços concluídos, no mínimo")).toHaveValue("1");
    expect(within(d).getByLabelText("Nota, no mínimo")).toHaveValue("4,0");
  });

  it("Aprovar só aparece depois de Ver quantos; mudar a nota esconde o botão", async () => {
    renderPage();
    const d = await openDialog();
    expect(approveBtn(d)).toBeNull();
    seeHowMany(d);
    expect(await within(d).findByText(/Serão aprovados: 158/)).toBeInTheDocument();
    expect(api.previewHistoryApproval).toHaveBeenCalledWith({ minCompletedServices: 1, minRating: 4 });
    expect(approveBtn(d)).toBeInTheDocument();
    expect(within(d).getByText("Ana Souza")).toBeInTheDocument();
    expect(within(d).getByText(/nenhuma avaliação fica de fora \(nota 0\)\. São 40 pessoas\./)).toBeInTheDocument();
    fireEvent.change(within(d).getByLabelText("Nota, no mínimo"), { target: { value: "3,5" } });
    expect(approveBtn(d)).toBeNull();
    expect(within(d).queryByText(/Serão aprovados/)).not.toBeInTheDocument();
  });

  it("critério inválido não chama a API e mostra o erro", async () => {
    renderPage();
    const d = await openDialog();
    fireEvent.change(within(d).getByLabelText("Nota, no mínimo"), { target: { value: "9" } });
    seeHowMany(d);
    expect(await within(d).findByRole("alert")).toHaveTextContent("Nota: de 0 a 5");
    expect(api.previewHistoryApproval).not.toHaveBeenCalled();
  });

  it("sem motivo o botão fica desativado", async () => {
    renderPage();
    const d = await openDialog();
    seeHowMany(d);
    await within(d).findByText(/Serão aprovados/);
    expect(approveBtn(d)).toBeDisabled();
    fireEvent.change(within(d).getByLabelText("Motivo"), { target: { value: "   " } });
    expect(approveBtn(d)).toBeDisabled();
    fireEvent.change(within(d).getByLabelText("Motivo"), { target: { value: "Já trabalham" } });
    expect(approveBtn(d)).toBeEnabled();
    expect(approveBtn(d)).toHaveTextContent("Aprovar 158 pessoas");
  });

  it("409 HISTORY_COUNT_MISMATCH: mostra o número novo e apaga a prévia", async () => {
    api.applyHistoryApproval.mockRejectedValue(
      apiError(409, { code: "HISTORY_COUNT_MISMATCH", message: "x", eligible: 160 }),
    );
    renderPage();
    const d = await openDialog();
    seeHowMany(d);
    await within(d).findByText(/Serão aprovados/);
    fireEvent.change(within(d).getByLabelText("Motivo"), { target: { value: "Já trabalham" } });
    fireEvent.click(approveBtn(d)!);
    expect(await within(d).findByText("A contagem mudou para 160. Veja a prévia de novo.")).toBeInTheDocument();
    expect(within(d).queryByText(/Serão aprovados/)).not.toBeInTheDocument();
    expect(approveBtn(d)).toBeNull();
    expect(api.applyHistoryApproval).toHaveBeenCalledWith({
      minCompletedServices: 1,
      minRating: 4,
      reason: "Já trabalham",
      confirmCount: 158,
    });
  });

  it("sucesso mostra que ninguém recebe mensagem e invalida o Onboarding", async () => {
    api.applyHistoryApproval.mockResolvedValue({ batchId: "b1", approved: 156, skipped: 2 });
    const { spy } = renderPage();
    const d = await openDialog();
    seeHowMany(d);
    await within(d).findByText(/Serão aprovados/);
    fireEvent.change(within(d).getByLabelText("Motivo"), { target: { value: "Já trabalham" } });
    fireEvent.click(approveBtn(d)!);
    expect(
      await within(d).findByText(
        "156 aprovadas, 2 puladas porque mudaram de situação. Ninguém recebe mensagem por esta aprovação.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ["admin", "orientation"] }));
    expect(approveBtn(d)).toBeNull();
    expect(within(d).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
  });

  it("clique duplo em Aprovar → uma chamada", async () => {
    let resolve!: (v: unknown) => void;
    api.applyHistoryApproval.mockReturnValue(new Promise((r) => (resolve = r)));
    renderPage();
    const d = await openDialog();
    seeHowMany(d);
    await within(d).findByText(/Serão aprovados/);
    fireEvent.change(within(d).getByLabelText("Motivo"), { target: { value: "Já trabalham" } });
    const btn = approveBtn(d)!;
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(api.applyHistoryApproval).toHaveBeenCalledTimes(1));
    fireEvent.click(btn);
    expect(api.applyHistoryApproval).toHaveBeenCalledTimes(1);
    resolve({ batchId: "b", approved: 158, skipped: 0 });
    await within(d).findByText(/158 aprovadas/);
  });
});

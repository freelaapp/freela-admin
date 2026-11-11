import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getLot, getLines, getCandidates } = vi.hoisted(() => ({
  getLot: vi.fn(),
  getLines: vi.fn(),
  getCandidates: vi.fn(),
}));
vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "lot-1" }) }));
vi.mock("@/modules/admin/infrastructure/lots-api", () => ({ getAdminLot: getLot }));
vi.mock("@/modules/admin/infrastructure/lot-lines-api", () => ({ getAdminLotLines: getLines }));
vi.mock("@/modules/admin/infrastructure/lot-choice-api", () => ({
  getAdminLotCandidates: getCandidates,
  chooseAdminLot: vi.fn(),
}));

import LoteDetalhePage from "../page";

function httpError(status: number, code?: string) {
  const err = new AxiosError("x");
  err.response = { status, data: code ? { error: { code, message: "m" } } : {} } as never;
  return err;
}

const lot = {
  id: "lot-1",
  serviceDate: "2026-11-14",
  trigger: "EQUAL_GROUP",
  createdAt: null,
  past: false,
  nextStep: "PAY",
  promiseCorrectedAt: null,
  totals: { vacancies: 18, functions: 1, chosen: 7, paid: 0, free: 11, candidatesToChoose: 13, chosenUnpaid: 7, cancelled: 0 },
  groups: [
    {
      groupKey: "k1",
      title: "Garçom",
      serviceType: "garcom",
      startTime: "2026-11-14T21:00:00.000Z",
      endTime: "2026-11-15T02:00:00.000Z",
      address: null,
      vacancies: 12,
      chosen: 5,
      paid: 0,
      free: 7,
      candidatesToChoose: 9,
      representativeVacancyId: "vac-1",
      vacancyIds: ["vac-1"],
    },
  ],
  inSelection: [
    { vacancyId: "vac-9", title: "Copeiro", startTime: "2026-11-14T21:00:00.000Z", endTime: "2026-11-15T02:00:00.000Z" },
  ],
  contractorId: "c1",
  companyName: "Buffet Villa",
  firstStartTime: "2026-11-14T21:00:00.000Z",
  attention: ["UNPAID_SOON"],
  choice: null,
};

const choice = {
  max: 20,
  billing: "PREPAID",
  unpaidCount: 7,
  unpaidInCents: 156000,
  groups: [],
  exits: [
    { candidacyId: "c9", vacancyId: "vac-1", groupKey: "k1", title: "Garçom", name: "Ana Souza", byKind: "SYSTEM", reason: "LOT_ASK_NO_ANSWER", at: "2026-11-13T17:00:00.000Z", vacancyPaid: false, vacancyRefilled: false },
  ],
  asks: { scheduled: 1, asking: 2, confirmed: 3, undelivered: 0, nextDeadlineAt: null },
};

function httpErrorOff() {
  return httpError(404, "VACANCY_LOTS_DISABLED");
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <LoteDetalhePage />
    </QueryClientProvider>,
  );
}

describe("/lotes/[id] (A3, só leitura)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Por padrão, a API sem as fatias novas: a tela é a da fatia 1.
    getLines.mockRejectedValue(httpErrorOff());
  });

  it("mostra a empresa, 'A empresa vê', as funções e as vagas em seleção", async () => {
    getLot.mockResolvedValue(lot);
    renderPage();
    expect(await screen.findByText("Buffet Villa · sáb 14/11")).toBeInTheDocument();
    expect(screen.getByTestId("company-sees")).toHaveTextContent("A empresa vê: “Falta pagar 7 escolhidos.");
    expect(screen.getByTestId("lot-group")).toHaveTextContent("Garçom · 18:00 às 23:00");
    expect(screen.getByTestId("lot-group")).toHaveTextContent("12 vagas · 5 escolhidas · 0 pagas · 7 livres");
    expect(screen.getAllByRole("link", { name: "Abrir a vaga" })[0]).toHaveAttribute("href", "/jobs?vaga=vac-1");
    expect(screen.getByTestId("lot-in-selection")).toHaveTextContent("Copeiro");
    expect(screen.getByText("7 escolhidos sem pagar e começa em menos de 3 h")).toBeInTheDocument();
    expect(await screen.findByTestId("lot-lines-off")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/R\$/);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByTestId("lot-choice-day")).toBeNull();
  });

  it("com `choice`: 'Falta pagar' com a conta, as perguntas, quem saiu e o botão 'Escolher pelo lote'", async () => {
    getLot.mockResolvedValue({ ...lot, choice });
    renderPage();
    expect(await screen.findByTestId("lot-choice-day")).toHaveTextContent(
      "Falta pagar: 7 vagas com escolhido e sem pagamento = R$ 1560,00",
    );
    expect(screen.getByTestId("lot-choice-day")).toHaveTextContent("3 disseram que ainda podem vir");
    expect(screen.getByTestId("lot-exit")).toHaveTextContent("Ana Souza");
    expect(screen.getByRole("button", { name: "Escolher pelo lote" })).toBeInTheDocument();
  });

  it("lote que já passou não oferece 'Escolher pelo lote'", async () => {
    getLot.mockResolvedValue({ ...lot, past: true, choice });
    renderPage();
    await screen.findByTestId("lot-choice-day");
    expect(screen.queryByRole("button", { name: "Escolher pelo lote" })).toBeNull();
  });

  it("abre o diálogo da função só ao clicar", async () => {
    getLot.mockResolvedValue({ ...lot, choice });
    getCandidates.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(getCandidates).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Escolher pelo lote" }));
    expect(await screen.findByText("Escolher pelo lote: Garçom")).toBeInTheDocument();
    expect(getCandidates).toHaveBeenCalledWith("lot-1", "k1");
  });

  it("404 LOT_NOT_FOUND: 'Não encontramos este lote.', sem erro", async () => {
    getLot.mockRejectedValue(httpError(404, "LOT_NOT_FOUND"));
    renderPage();
    expect(await screen.findByTestId("lot-not-found")).toHaveTextContent("Não encontramos este lote.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("404 sem código (API antiga): 'ainda não ligados'", async () => {
    getLot.mockRejectedValue(httpError(404));
    renderPage();
    expect(await screen.findByTestId("lot-not-found")).toHaveTextContent("Os lotes ainda não estão ligados.");
  });

  it("500: erro com 'Tentar de novo'", async () => {
    getLot.mockRejectedValue(httpError(500));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar o lote.");
  });
});

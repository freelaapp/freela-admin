import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getLot } = vi.hoisted(() => ({ getLot: vi.fn() }));
vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "lot-1" }) }));
vi.mock("@/modules/admin/infrastructure/lots-api", () => ({ getAdminLot: getLot }));

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
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <LoteDetalhePage />
    </QueryClientProvider>,
  );
}

describe("/lotes/[id] (A3, só leitura)", () => {
  beforeEach(() => vi.clearAllMocks());

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
    expect(document.body.textContent).not.toMatch(/R\$/);
    expect(screen.queryByRole("button")).toBeNull();
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

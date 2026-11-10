import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getLots } = vi.hoisted(() => ({ getLots: vi.fn() }));
vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("@/modules/admin/infrastructure/lots-api", () => ({ getAdminLots: getLots }));

import LotesPage from "../page";

function httpError(status: number, code?: string) {
  const err = new AxiosError("x");
  err.response = { status, data: code ? { error: { code, message: "m" } } : {} } as never;
  return err;
}

const lot = (over: Record<string, unknown> = {}) => ({
  id: "lot-1",
  serviceDate: "2026-11-14",
  trigger: "EQUAL_GROUP",
  createdAt: null,
  past: false,
  nextStep: "CHOOSE",
  promiseCorrectedAt: null,
  totals: { vacancies: 18, functions: 3, chosen: 7, paid: 0, free: 11, candidatesToChoose: 13, chosenUnpaid: 7, cancelled: 0 },
  groups: [],
  inSelection: [],
  contractorId: "c1",
  companyName: "Buffet Villa",
  firstStartTime: null,
  attention: [],
  ...over,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <LotesPage />
    </QueryClientProvider>,
  );
}

describe("/lotes (A2)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("carregando: mostra os esqueletos", () => {
    getLots.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getAllByTestId("lot-skeleton")).toHaveLength(3);
  });

  it("vazio: diz que não há lotes", async () => {
    getLots.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Nenhum lote nos próximos 7 dias.")).toBeInTheDocument();
  });

  it.each([
    ["API antiga (404 sem código)", httpError(404)],
    ["chave desligada", httpError(404, "VACANCY_LOTS_DISABLED")],
  ])("%s: 'ainda não ligado', sem erro", async (_n, err) => {
    getLots.mockRejectedValue(err);
    renderPage();
    expect(await screen.findByText("Os lotes ainda não estão ligados.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getLots).toHaveBeenCalledTimes(1);
  });

  it("erro de verdade (500): mensagem e 'Tentar de novo'", async () => {
    getLots.mockRejectedValue(httpError(500));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar os lotes.");
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it("com atenção: o motivo vem escrito no cartão, sem reais", async () => {
    getLots.mockResolvedValue([
      lot({ attention: ["FREE_SOON", "NO_CANDIDATES"] }),
      lot({ id: "lot-2", companyName: "Bar do Zé", serviceDate: "2026-11-15" }),
    ]);
    renderPage();
    expect(await screen.findByText("Buffet Villa")).toBeInTheDocument();
    expect(screen.getByText("sáb 14/11")).toBeInTheDocument();
    const reasons = screen.getAllByTestId("lot-attention").map((n) => n.textContent);
    expect(reasons).toEqual([
      "Faltam 11 escolhas e começa em menos de 6 h",
      "Ninguém se candidatou a alguma função",
    ]);
    expect(screen.getAllByText("18 vagas · 7 escolhidas · 0 pagas · 11 livres")).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/R\$/);
    expect(screen.getAllByRole("link", { name: "Abrir o lote" })[0]).toHaveAttribute("href", "/lotes/lot-1");

    fireEvent.click(screen.getByRole("tab", { name: "Atenção 1" }));
    expect(screen.getAllByTestId("lot-card")).toHaveLength(1);
    expect(screen.queryByText("Bar do Zé")).toBeNull();
  });
});

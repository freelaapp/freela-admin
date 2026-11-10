import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { byVacancy } = vi.hoisted(() => ({ byVacancy: vi.fn() }));
vi.mock("@/modules/admin/infrastructure/lots-api", () => ({ getAdminLotByVacancy: byVacancy }));

import { VacancyLotLine } from "./vacancy-lot-line";

const lot = {
  id: "lot-1",
  serviceDate: "2026-11-14",
  totals: { vacancies: 12, chosen: 5, paid: 3, free: 7, chosenUnpaid: 2, candidatesToChoose: 4, functions: 1, cancelled: 0 },
};

function httpError(status: number, code?: string) {
  const err = new AxiosError("x");
  err.response = { status, data: code ? { error: { code } } : {} } as never;
  return err;
}

function renderLine() {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <VacancyLotLine vacancyId="vac-1" />
    </QueryClientProvider>,
  );
}

describe("A1: linha do lote no modal da vaga", () => {
  beforeEach(() => vi.clearAllMocks());

  it("com lote: mostra as contagens e o link", async () => {
    byVacancy.mockResolvedValue({ lot, besideLot: null });
    renderLine();
    expect(await screen.findByTestId("vacancy-lot-line")).toHaveTextContent(
      "Lote: 12 vagas · 5 escolhidas · 3 pagas",
    );
    expect(screen.getByRole("link", { name: "Abrir o lote" })).toHaveAttribute("href", "/lotes/lot-1");
  });

  it("vaga em seleção fora do lote: 'ao lado do lote de sáb 14/11'", async () => {
    byVacancy.mockResolvedValue({ lot: null, besideLot: lot });
    renderLine();
    expect(await screen.findByTestId("vacancy-lot-line")).toHaveTextContent(
      "Em seleção, ao lado do lote de sáb 14/11",
    );
  });

  it("sem lote (os dois nulos): nada novo na tela", async () => {
    byVacancy.mockResolvedValue({ lot: null, besideLot: null });
    const { container } = renderLine();
    await waitFor(() => expect(byVacancy).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["API antiga (404 sem código)", httpError(404)],
    ["chave desligada", httpError(404, "VACANCY_LOTS_DISABLED")],
    ["erro 500", httpError(500)],
  ])("%s: nada na tela e nenhum erro", async (_n, err) => {
    byVacancy.mockRejectedValue(err);
    const { container } = renderLine();
    await waitFor(() => expect(byVacancy).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("404 não tenta de novo", async () => {
    byVacancy.mockRejectedValue(httpError(404));
    renderLine();
    await waitFor(() => expect(byVacancy).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 30));
    expect(byVacancy).toHaveBeenCalledTimes(1);
  });
});

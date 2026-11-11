import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getLines } = vi.hoisted(() => ({ getLines: vi.fn() }));
vi.mock("@/modules/admin/infrastructure/lot-lines-api", () => ({ getAdminLotLines: getLines }));

import { LotLinesSection } from "./lot-lines-section";

function httpError(status: number, code?: string) {
  const err = new AxiosError("x");
  err.response = { status, data: code ? { error: { code } } : {} } as never;
  return err;
}

const chosen = { candidacyId: "c1", providerGlobalId: "g1", name: "Ana Souza" };
const base = {
  groupKey: "k",
  title: "Garçom",
  startTime: "2026-11-14T21:00:00.000Z",
  endTime: "2026-11-15T02:00:00.000Z",
  status: "CLOSED",
  job: null,
  arrival: null,
  attendance: null,
};
const data = {
  lotId: "l1",
  serviceDate: "2026-11-14",
  lines: [
    {
      ...base,
      vacancyId: "v1",
      chosen,
      ask: { state: "YES", askedForVacancyId: "v1", scheduledFor: null, askedAt: "2026-11-14T17:02:04.000Z", deadlineAt: null, answeredAt: "2026-11-14T17:12:31.000Z", answeredVia: "WHATSAPP", deliveredAt: "2026-11-14T17:02:05.000Z", closedAt: null },
      payment: { paid: true, paymentId: "p1", method: "WALLET", at: "2026-11-14T15:00:00.000Z", amountInCents: 18100, byBatch: true, batchId: "b-1", pixFeeWaivedInCents: 85 },
      arrival: { state: "ANSWERED", askedAt: null, answer: "ARRIVED", answeredAt: null, answeredAtLabel: "18h17", answeredVia: "SITE", outcome: null, aboutChosen: true },
    },
    { ...base, vacancyId: "v2", chosen: null, ask: null, payment: { paid: false, paymentId: null, method: null, at: null, amountInCents: null, byBatch: false, batchId: null, pixFeeWaivedInCents: 0 } },
  ],
};

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <LotLinesSection lotId="l1" enabled />
    </QueryClientProvider>,
  );
}

describe("A3: vaga por vaga", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mostra escolhido, pergunta, pagamento único com taxa dispensada, chegada e vaga livre", async () => {
    getLines.mockResolvedValue(data);
    renderSection();
    const lines = await screen.findAllByTestId("lot-line");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent("Ana Souza");
    expect(lines[0]).toHaveTextContent("Perguntado às 14h02, respondeu às 14h12 pelo WhatsApp: ainda pode vir.");
    expect(lines[0]).toHaveTextContent("Pago com saldo da carteira");
    expect(lines[0]).toHaveTextContent("Pagamento único (b-1)");
    expect(lines[0]).toHaveTextContent("Taxa do Pix dispensada nesta vaga: R$ 0,85");
    expect(lines[0]).toHaveTextContent("Chegou 18h17, respondido pelo site.");
    expect(lines[1]).toHaveTextContent("Vaga livre");
    expect(screen.getByTestId("lot-lines-summary")).toHaveTextContent("2 vagas no lote = 1 com escolhido + 1 livres");
  });

  it("404 (recurso desligado): a seção diz isso, sem erro e sem tentar de novo", async () => {
    getLines.mockRejectedValue(httpError(404, "VACANCY_LOTS_DISABLED"));
    renderSection();
    expect(await screen.findByTestId("lot-lines-off")).toHaveTextContent("recurso desligado");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getLines).toHaveBeenCalledTimes(1);
  });

  it("500: erro só nesta seção, com 'Tentar de novo'", async () => {
    getLines.mockRejectedValue(httpError(500));
    renderSection();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar a situação de cada vaga.");
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});

import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/admin/infrastructure/billing-api", () => ({
  listAdminInvoices: vi.fn(),
  getBillingSummary: vi.fn(),
  getBillingCompanies: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/held-repasses-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/admin/infrastructure/held-repasses-api")>()),
  listHeldRepasses: vi.fn(),
  releaseHeldRepasse: vi.fn(),
}));
const repasses = vi.hoisted(() => ({ data: [] as unknown[] }));
vi.mock("@/modules/admin/application/use-admin-repasses", () => ({
  useAdminRepasses: () => ({
    data: repasses.data,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

import { SUMMARY } from "@/modules/admin/application/billing.test-fixtures";
import { getBillingSummary } from "@/modules/admin/infrastructure/billing-api";
import {
  listHeldRepasses,
  type HeldRepasseItem,
  type HeldRepassesList,
  type HeldRepassesTotals,
} from "@/modules/admin/infrastructure/held-repasses-api";
import { FreelancerPayoutsView } from "./freelancer-payouts-view";

/** Hoje = ter 20/10/2026 10:00 em Brasília. */
const NOW = new Date("2026-10-20T13:00:00.000Z");

const ANA: HeldRepasseItem = {
  repasseId: "rep-ana",
  vacancyId: "ab12cd34-0000-0000-0000-000000000000",
  vacancyTitle: "Garçom",
  serviceDate: "2026-10-15",
  freelancer: { providerGlobalId: "pg-1", name: "Ana Souza", hasPixKey: true },
  company: { contractorUserId: "u-1", name: "Bar do Zé" },
  amountInCents: 9500,
  heldAt: "2026-10-16T02:00:00.000Z",
  expectedDate: "2026-10-19",
  effectiveDeadlineAt: "2026-10-23T03:00:00.000Z",
  invoice: { id: "inv-1", number: "FAT-2026-000123", status: "ISSUED", dueDate: "2026-10-19" },
  situation: "invoice_overdue",
  releaseAuthorized: false,
  calc: "teto = mín(prazo da retenção sex 23/10, bloqueio da fatura sex 23/10) = sex 23/10 00:00",
  source: "Repasse retido e a fatura do serviço.",
};

const JOAO: HeldRepasseItem = {
  ...ANA,
  repasseId: "rep-joao",
  vacancyId: "cd34ef56-0000-0000-0000-000000000000",
  vacancyTitle: "Cozinheiro",
  serviceDate: "2026-10-16",
  freelancer: { providerGlobalId: "pg-2", name: "João Lima", hasPixKey: false },
  amountInCents: 12000,
  expectedDate: "2026-10-26",
  effectiveDeadlineAt: "2026-10-30T03:00:00.000Z",
  invoice: null,
  situation: "awaiting_close",
};

const TOTALS: HeldRepassesTotals = {
  all: { count: 2, totalInCents: 21500 },
  awaitingClose: { count: 1, totalInCents: 12000 },
  invoiceOpen: { count: 0, totalInCents: 0 },
  invoiceOverdue: { count: 1, totalInCents: 9500 },
  releasing: { count: 0, totalInCents: 0 },
  deadline48h: { count: 0, totalInCents: 0 },
  calc: "fatura ainda aberta R$ 120,00 (1) + a vencer R$ 0,00 (0) + vencida R$ 95,00 (1) + liberando R$ 0,00 (0) = R$ 215,00 (2 retidos)",
  source: "Repasse retido (shared.repasses com status AWAITING_INVOICE).",
};

const list = (items: HeldRepasseItem[], totals: HeldRepassesTotals | null = TOTALS): HeldRepassesList => ({
  items,
  page: 1,
  pageSize: 200,
  total: items.length,
  hasMore: false,
  totals,
});

const BREAKDOWN = {
  onCompletion: { count: 40, valueInCents: 523170 },
  deadline: { count: 1, valueInCents: 9500 },
  admin: { count: 1, valueInCents: 9500 },
  invoiceCancelled: { count: 0, valueInCents: 0 },
};

function notFound(): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("falhou", "404", config, null, {
    status: 404,
    statusText: "",
    headers: {},
    config,
    data: { message: "Cannot GET /v1/admin/billing/held-repasses", statusCode: 404 },
  });
}

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FreelancerPayoutsView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  repasses.data = [];
  vi.mocked(listHeldRepasses).mockResolvedValue(list([ANA, JOAO]));
  vi.mocked(getBillingSummary).mockResolvedValue({
    ...SUMMARY,
    cards: { ...SUMMARY.cards, advanced: { ...SUMMARY.cards.advanced, breakdown: BREAKDOWN } },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Pagamentos aos freelancers — aguardando fatura", () => {
  it("três cards, cada um com a conta e a fonte", async () => {
    renderView();
    const held = await screen.findByTestId("kpi-held");
    expect(within(held).getByText("Retido aguardando fatura")).toBeInTheDocument();
    expect(within(held).getByText("R$ 215,00")).toBeInTheDocument();
    expect(within(held).getByText("2 pagamentos retidos · 1 com fatura vencida (R$ 95,00)")).toBeInTheDocument();
    expect(within(held).getByText(`Conta: ${TOTALS.calc}`)).toBeInTheDocument();

    const due = screen.getByTestId("kpi-due48h");
    expect(within(due).getByText("A Freela paga em até 2 dias se as empresas não pagarem")).toBeInTheDocument();
    expect(within(due).getByText("0 pagamentos · teto até qui 22/10 às 10:00")).toBeInTheDocument();

    const paid = await screen.findByTestId("kpi-paidByFreela");
    expect(within(paid).getByText("R$ 190,00")).toBeInTheDocument();
    expect(
      within(paid).getByText(
        "Conta: no teto R$ 95,00 (1) + Pagar agora R$ 95,00 (1) + fatura cancelada R$ 0,00 (0) = R$ 190,00",
      ),
    ).toBeInTheDocument();
  });

  it("lista do teto mais próximo, com fatura, previsto, garantido até e 'Pagar agora'", async () => {
    renderView();
    const table = await screen.findByTestId("data-table-desktop");
    expect(within(table).getByText("Pagamentos aguardando fatura, do teto mais próximo · Todas")).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Garantido até" })).toHaveAttribute("aria-sort", "ascending");
    expect(within(table).getByText("Ana Souza")).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "FAT-2026-000123" })).toHaveAttribute(
      "href",
      "/financeiro/faturas/inv-1",
    );
    expect(within(table).getByText("Vencida há 1 dia (venceu seg 19/10)")).toBeInTheDocument();
    expect(within(table).getByText("sex 23/10 às 00:00")).toBeInTheDocument();
    expect(within(table).getByText("em 3 dias")).toBeInTheDocument();
    expect(
      within(table).getByRole("button", { name: "Pagar agora R$ 95,00 para Ana Souza" }),
    ).toBeInTheDocument();
    // Sem chave Pix: sem botão, com o porquê.
    expect(within(table).getByText("sem chave Pix")).toBeInTheDocument();
    expect(within(table).queryByRole("button", { name: /para João Lima/ })).not.toBeInTheDocument();
    expect(within(table).getByText(/João não tinha chave Pix quando o serviço terminou/)).toBeInTheDocument();
    expect(within(table).getByText("Fatura ainda aberta: o serviço entra no próximo fechamento")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 2 de 2 · R$ 215,00 nesta página")).toBeInTheDocument();
    // No celular, um cartão por pagamento.
    expect(within(screen.getByTestId("data-table-cards")).getAllByRole("listitem")).toHaveLength(2);
  });

  it("chips com a contagem no nome; trocar de chip pede a situação à API", async () => {
    renderView();
    const chips = await screen.findByRole("group", { name: "Situação da fatura" });
    expect(await within(chips).findByRole("button", { name: "Vencida, 1" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(within(chips).getByRole("button", { name: "Vencida, 1" }));
    await waitFor(() =>
      expect(listHeldRepasses).toHaveBeenLastCalledWith({ situation: "invoice_overdue", page: 1, pageSize: 200 }),
    );
    expect(within(chips).getByRole("button", { name: "Vencida, 1" })).toHaveAttribute("aria-pressed", "true");
  });

  it("'Pagar agora' abre o diálogo da linha", async () => {
    renderView();
    const table = await screen.findByTestId("data-table-desktop");
    fireEvent.click(within(table).getByRole("button", { name: "Pagar agora R$ 95,00 para Ana Souza" }));
    expect(screen.getByRole("heading", { name: "Pagar agora R$ 95,00 para Ana Souza?" })).toBeInTheDocument();
  });

  it("nenhum retido: texto verdadeiro com a regra ligada ou desligada", async () => {
    vi.mocked(listHeldRepasses).mockResolvedValue(
      list([], { ...TOTALS, all: { count: 0, totalInCents: 0 }, awaitingClose: { count: 0, totalInCents: 0 }, invoiceOverdue: { count: 0, totalInCents: 0 } }),
    );
    renderView();
    expect(await screen.findByText(/Nenhum pagamento aguardando fatura agora/)).toBeInTheDocument();
  });

  it("API de antes (sem totais e sem a composição do adiantado): os cards não aparecem", async () => {
    vi.mocked(listHeldRepasses).mockResolvedValue(list([ANA], null));
    vi.mocked(getBillingSummary).mockResolvedValue(SUMMARY);
    renderView();
    expect(await screen.findAllByText("Ana Souza")).not.toHaveLength(0);
    expect(screen.queryByTestId("kpi-held")).not.toBeInTheDocument();
    expect(screen.queryByTestId("kpi-paidByFreela")).not.toBeInTheDocument();
  });

  it("rota fora do ar (404): aviso calmo, sem erro; 'Todos os repasses' continua", async () => {
    vi.mocked(listHeldRepasses).mockRejectedValue(notFound());
    repasses.data = [
      {
        id: "r-1",
        vacancyId: "ab12cd34-0000",
        jobId: "j-1",
        providerGlobalId: "pg-1234567890abcdef",
        pixKey: "",
        pixKeyType: "",
        amountInCents: 9500,
        status: "AWAITING_INVOICE",
        confirmedAt: null,
        createdAt: "2026-10-16T02:00:00.000Z",
      },
      {
        id: "r-2",
        vacancyId: "ef56ab12-0000",
        jobId: "j-2",
        providerGlobalId: "pg-abcdef",
        pixKey: "x",
        pixKeyType: "CPF",
        amountInCents: 12000,
        status: "CREDIT_UNKNOWN",
        confirmedAt: null,
        createdAt: "2026-10-16T02:00:00.000Z",
      },
    ];
    renderView();
    expect(
      await screen.findByText("Os pagamentos aguardando fatura ainda não estão disponíveis neste ambiente."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByTestId("kpi-held")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Todos os repasses" }));
    const table = screen.getByTestId("data-table-desktop");
    expect(within(table).getByText("Aguardando a fatura")).toBeInTheDocument();
    expect(within(table).getByText("Em verificação")).toBeInTheDocument();
    expect(within(table).getByText("R$ 95,00")).toBeInTheDocument();
  });
});

import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("@/modules/admin/infrastructure/billing-api", () => ({
  listAdminInvoices: vi.fn(),
  getBillingSummary: vi.fn(),
}));

const finance = vi.hoisted(() => ({
  summary: {} as Record<string, unknown>,
  payments: [] as unknown[],
}));
vi.mock("@/modules/admin/application/use-admin-finance", () => ({
  useFinanceSummary: () => ({ data: finance.summary, isLoading: false, isFetching: false }),
  useFinanceTransactions: () => ({ data: { items: [], total: 0 }, isLoading: false, isFetching: false }),
}));
vi.mock("@/modules/admin/application/use-admin-payments", () => ({
  useAdminPayments: () => ({ data: finance.payments, isLoading: false }),
}));
vi.mock("@/modules/admin/application/use-admin-repasses", () => ({
  useAdminRepasses: () => ({ data: [], isLoading: false }),
}));

import { OVERDUE_INVOICE, SUMMARY } from "@/modules/admin/application/billing.test-fixtures";
import {
  getBillingSummary,
  listAdminInvoices,
} from "@/modules/admin/infrastructure/billing-api";
import FinanceiroPage from "../page";

const FINANCE_SUMMARY = {
  saldoWooviCents: 1000000,
  saldoAsaasCents: 0,
  saldoTotalCents: 1000000,
  entradasCents: 500000,
  saidasCents: 300000,
  estornosCents: 10000,
  lucroCents: 80000,
  gatewayFeesCents: 1700,
  entradasCount: 12,
  saidasCount: 10,
  estornosCount: 1,
  receivableCents: 676690,
  lucroBasis: "COMPETENCIA",
  lucroLabel: "Lucro (por competência)",
  calc: {
    entradas: "pagamentos recebidos R$ 4.000,00 (sem o faturado) + faturas pagas R$ 1.000,00 = R$ 5.000,00",
    estornos: "pagamentos estornados (sem o faturado, que vira crédito na fatura) = R$ 100,00",
    lucro: "taxa da plataforma das vagas contratadas, faturadas inclusive R$ 900,00 − taxa Pix R$ 17,00 (20 × R$ 0,85) − bônus R$ 83,00 = R$ 800,00",
    receivable: "faturas em aberto R$ 4.661,50 + ainda não faturado R$ 2.105,40 = R$ 6.766,90",
  },
};

/** Botão de uma seção do Financeiro (as "abas"). */
const section = (name: string) =>
  within(screen.getByRole("group", { name: "Seções do Financeiro" })).findByRole("button", { name });

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FinanceiroPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  finance.summary = FINANCE_SUMMARY;
  finance.payments = [];
  vi.mocked(getBillingSummary).mockResolvedValue(SUMMARY);
  vi.mocked(listAdminInvoices).mockResolvedValue({
    items: [OVERDUE_INVOICE],
    page: 1,
    pageSize: 20,
    total: 1,
    hasMore: false,
  });
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("Financeiro — aba Faturas", () => {
  it("aba Faturas (entre Repasses e Estornos) renderiza a InvoicesView", async () => {
    renderPage();

    const sections = screen.getByRole("group", { name: "Seções do Financeiro" });
    const tabs = within(sections).getAllByRole("button").map((t) => t.textContent);
    expect(tabs).toEqual([
      "Visão Geral",
      "Transações",
      "Pagamentos",
      "Repasses",
      "Faturas",
      "Estornos & Cancelamentos",
    ]);
    fireEvent.click(within(sections).getByRole("button", { name: "Faturas" }));

    expect(within(sections).getByRole("button", { name: "Faturas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(sections).getByRole("button", { name: "Visão Geral" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(await screen.findByText("A receber: faturas a vencer")).toBeInTheDocument();
    // Tabela (desktop) e cartões (celular) mostram a mesma fatura.
    expect(await screen.findAllByText("FAT-2026-000123")).toHaveLength(2);
    // A aba tem o próprio filtro (data de fechamento): a barra de período da página some.
    expect(screen.queryByText("Este mês")).not.toBeInTheDocument();
  });

  it("?aba=faturas abre direto na aba Faturas (volta do detalhe)", async () => {
    window.history.replaceState(null, "", "/financeiro?aba=faturas");
    renderPage();

    expect(await section("Faturas")).toHaveAttribute("aria-pressed", "true");
  });

  it("alerta de pagamento em dobro com link", async () => {
    vi.mocked(getBillingSummary).mockResolvedValue({
      ...SUMMARY,
      doublePayments: {
        count: 1,
        text: "1 pagamento em dobro em outubro/2026 para devolver: FAT-2026-000123 (Bar do Zé).",
        calc: "",
        source: "",
        latest: [
          { invoiceId: "inv-123", number: "FAT-2026-000123", companyName: "Bar do Zé", at: "2026-10-21T12:00:00.000Z" },
        ],
      },
    });
    renderPage();
    fireEvent.click(await section("Faturas"));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("link", { name: "Ver FAT-2026-000123" })).toHaveAttribute(
      "href",
      "/financeiro/faturas/inv-123",
    );
  });
});

describe("Financeiro — Visão Geral e Pagamentos", () => {
  it("Visão Geral: card 'A receber (faturado)' e 'Lucro (por competência)', com a conta", () => {
    renderPage();

    const receivable = screen.getByText("A receber (faturado)").closest(".flex.flex-col") as HTMLElement;
    expect(within(receivable).getByText("R$ 6.766,90")).toBeInTheDocument();
    expect(receivable).toHaveTextContent(
      "Conta: faturas em aberto R$ 4.661,50 + ainda não faturado R$ 2.105,40 = R$ 6.766,90",
    );
    const profit = screen.getByText("Lucro (por competência)").closest(".flex.flex-col") as HTMLElement;
    expect(profit).toHaveTextContent(
      "Conta: taxa da plataforma das vagas contratadas, faturadas inclusive R$ 900,00 − taxa Pix R$ 17,00 (20 × R$ 0,85) − bônus R$ 83,00 = R$ 800,00",
    );
    expect(screen.queryByText("Lucro (taxa da plataforma)")).not.toBeInTheDocument();
  });

  it("API sem o faturado: 'A receber (faturado)' indisponível e o Lucro com o rótulo de antes", () => {
    finance.summary = {
      ...FINANCE_SUMMARY,
      receivableCents: undefined,
      lucroLabel: undefined,
      calc: undefined,
    };
    renderPage();

    expect(screen.getByText("Lucro (taxa da plataforma)")).toBeInTheDocument();
    const receivable = screen.getByText("A receber (faturado)").closest(".flex.flex-col") as HTMLElement;
    expect(within(receivable).getByText("Indisponível")).toBeInTheDocument();
  });

  it("Pagamentos: INVOICE com 'Faturado (não é entrada de caixa)'", async () => {
    finance.payments = [
      {
        id: "p1",
        status: "COMPLETED",
        value: 12481,
        serviceAmountInCents: 9500,
        correlationId: "invoice-correlation-1",
        paymentLinkUrl: null,
        createdAt: "2026-10-10T12:00:00.000Z",
        method: "INVOICE",
        provider: "internal",
      },
      {
        id: "p2",
        status: "COMPLETED",
        value: 12481,
        serviceAmountInCents: 9500,
        correlationId: "pix-correlation-2",
        paymentLinkUrl: null,
        createdAt: "2026-10-10T12:00:00.000Z",
        method: "PIX",
        provider: "openpix",
      },
    ];
    renderPage();
    fireEvent.click(await section("Pagamentos"));

    const table = screen.getByRole("table");
    const invoiced = within(table).getByText("invoice-corr").closest("tr") as HTMLElement;
    expect(within(invoiced).getByText("Faturado (não é entrada de caixa)")).toBeInTheDocument();
    expect(within(invoiced).getByText("Faturado")).toBeInTheDocument();
    const pix = within(table).getByText("pix-correlat").closest("tr") as HTMLElement;
    expect(within(pix).getByText("Diária")).toBeInTheDocument();
    expect(within(pix).getByText("Pago")).toBeInTheDocument();
  });
});

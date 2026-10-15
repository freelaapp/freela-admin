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
  getBillingCompanies: vi.fn(),
}));

const finance = vi.hoisted(() => ({
  summary: {} as Record<string, unknown>,
  summaryError: false,
  payments: [] as unknown[],
  paymentsError: false,
  transactions: [] as unknown[],
  refetch: () => {},
}));
vi.mock("@/modules/admin/application/use-admin-finance", () => ({
  useFinanceSummary: () =>
    finance.summaryError
      ? { data: undefined, isLoading: false, isFetching: false, isError: true, refetch: finance.refetch }
      : { data: finance.summary, isLoading: false, isFetching: false, isError: false },
  useFinanceTransactions: () => ({
    data: { items: finance.transactions, truncated: false },
    isLoading: false,
    isFetching: false,
  }),
}));
vi.mock("@/modules/admin/application/use-admin-payments", () => ({
  useAdminPayments: () =>
    finance.paymentsError
      ? { data: undefined, isLoading: false, isError: true, refetch: finance.refetch }
      : { data: finance.payments, isLoading: false },
}));
vi.mock("@/modules/admin/application/use-admin-repasses", () => ({
  useAdminRepasses: () => ({ data: [], isLoading: false }),
}));

import {
  COMPANIES,
  OVERDUE_INVOICE,
  SUMMARY,
} from "@/modules/admin/application/billing.test-fixtures";
import {
  getBillingCompanies,
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
  invoicedCents: 24962,
  invoicedCount: 2,
  lucroBasis: "COMPETENCIA",
  lucroLabel: "Lucro (por competência)",
  calc: {
    entradas: "pagamentos recebidos R$ 4.000,00 (sem o faturado) + faturas pagas R$ 1.000,00 = R$ 5.000,00",
    estornos: "pagamentos estornados (sem o faturado, que vira crédito na fatura) = R$ 100,00",
    lucro: "taxa da plataforma das vagas contratadas, faturadas inclusive R$ 900,00 − taxa Pix R$ 17,00 (20 × R$ 0,85) − bônus R$ 83,00 = R$ 800,00",
    receivable: "faturas em aberto R$ 4.661,50 + ainda não faturado R$ 2.105,40 = R$ 6.766,90",
    invoiced:
      "soma de 2 vagas aceitas no faturado no período (pagamento INVOICE concluído) = R$ 249,62; venda, não caixa: o dinheiro entra quando a fatura é paga",
    saidas: "repasses pagos R$ 2.900,00 (9) + bônus pagos R$ 100,00 (1) = R$ 3.000,00",
    liquido: "entradas R$ 5.000,00 − saídas R$ 3.000,00 − estornos R$ 100,00 = R$ 1.900,00",
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
  finance.summaryError = false;
  finance.payments = [];
  finance.paymentsError = false;
  finance.transactions = [];
  vi.mocked(getBillingCompanies).mockResolvedValue(COMPANIES);
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
      "Empresas faturadas",
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

  it("?aba=empresas-faturadas abre direto na lista das empresas", async () => {
    window.history.replaceState(null, "", "/financeiro?aba=empresas-faturadas");
    renderPage();

    expect(await section("Empresas faturadas")).toHaveAttribute("aria-pressed", "true");
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

describe("Financeiro — Empresas faturadas", () => {
  it("lista as empresas do faturado (sem barra de período) e 'Ver faturas' abre a aba Faturas filtrada", async () => {
    renderPage();
    fireEvent.click(await section("Empresas faturadas"));

    expect(await screen.findAllByText("Chopp e Espeto Valinhos")).toHaveLength(2);
    expect(screen.queryByText("Este mês")).not.toBeInTheDocument();
    const table = screen.getByRole("table");
    const row = within(table).getByText("Chopp e Espeto Valinhos").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Ver faturas" }));

    expect(await section("Faturas")).toHaveAttribute("aria-pressed", "true");
    expect(
      await screen.findByRole("button", { name: "Tirar o filtro da empresa Chopp e Espeto Valinhos" }),
    ).toBeInTheDocument();
    expect(listAdminInvoices).toHaveBeenCalledWith(
      expect.objectContaining({ contractorUserId: "dono-valinhos" }),
    );
  });
});

describe("Financeiro — números do faturado e estados de erro", () => {
  it("Visão Geral: 'Faturado no período (não é caixa)' com a conta; Saídas e Líquido com a conta", () => {
    renderPage();

    const invoiced = screen
      .getByText("Faturado no período (não é caixa)")
      .closest(".flex.flex-col") as HTMLElement;
    expect(within(invoiced).getByText("R$ 249,62")).toBeInTheDocument();
    expect(invoiced).toHaveTextContent(`Conta: ${FINANCE_SUMMARY.calc.invoiced}`);
    const saidas = screen.getByText("Saídas (repasses + bônus)").closest(".flex.flex-col") as HTMLElement;
    expect(saidas).toHaveTextContent(`Conta: ${FINANCE_SUMMARY.calc.saidas}`);
    const liquido = screen.getByText("Líquido no período").closest(".flex.flex-col") as HTMLElement;
    expect(liquido).toHaveTextContent(`Conta: ${FINANCE_SUMMARY.calc.liquido}`);
  });

  it("Visão Geral com erro: 'Tentar de novo', não cards zerados", () => {
    finance.summaryError = true;
    const refetch = vi.fn();
    finance.refetch = refetch;
    renderPage();

    expect(screen.getByText("Não conseguimos carregar o resumo financeiro.")).toBeInTheDocument();
    expect(screen.queryByText("Entradas (bruto transacionado)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("Transações: faturado fora das somas e à parte; fatura paga (PAID) conta como liquidada", async () => {
    const at = "2026-10-15T13:31:00.000Z";
    const base = { provider: "openpix", method: "PIX", vacancyId: null, reference: null, createdAt: at };
    finance.transactions = [
      { ...base, id: "pay-pix", type: "entrada", kind: "charge", amountInCents: 16355, status: "COMPLETED", isCash: true },
      {
        ...base,
        id: "pay-fat",
        type: "entrada",
        kind: "invoiced",
        amountInCents: 12481,
        status: "COMPLETED",
        provider: "internal",
        method: "INVOICE",
        isCash: false,
        label: "Faturado (não é entrada de caixa)",
      },
      {
        ...base,
        id: "fat-1-paid",
        type: "entrada",
        kind: "invoice_payment",
        amountInCents: 124860,
        status: "PAID",
        isCash: true,
        label: "Fatura FAT-2026-000123 paga (Pix)",
      },
    ];
    renderPage();
    fireEvent.click(await section("Transações"));

    expect(screen.getByText("Entradas liquidadas R$ 1.412,15")).toBeInTheDocument();
    expect(screen.getByText("Faturado (não é caixa) R$ 124,81")).toBeInTheDocument();
    // A fatura paga não é mais "não liquidada".
    expect(screen.queryByText(/não liquidada/)).not.toBeInTheDocument();
    // O gateway do faturado é "Faturado", não "internal".
    expect(screen.queryByText("internal")).not.toBeInTheDocument();
  });

  it("Pagamentos com erro: 'Tentar de novo', não tabela vazia", async () => {
    finance.paymentsError = true;
    renderPage();
    fireEvent.click(await section("Pagamentos"));

    expect(screen.getByText("Não conseguimos carregar os pagamentos.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("Pagamentos: colunas Empresa e Meio", async () => {
    finance.payments = [
      {
        id: "p1",
        status: "COMPLETED",
        value: 12481,
        serviceAmountInCents: 9500,
        correlationId: "invoice-correlation-1",
        paymentLinkUrl: null,
        createdAt: "2026-10-15T13:31:00.000Z",
        method: "INVOICE",
        provider: "internal",
        vacancyId: "v1",
        companyName: "Chopp e Espeto Valinhos",
        contractorUserId: "dono-valinhos",
      },
    ];
    renderPage();
    fireEvent.click(await section("Pagamentos"));

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Empresa" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Meio" })).toBeInTheDocument();
    const row = within(table).getByText("Chopp e Espeto Valinhos").closest("tr") as HTMLElement;
    expect(within(row).getByText("Fatura")).toBeInTheDocument();
  });
});

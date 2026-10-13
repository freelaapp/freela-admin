import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/admin/infrastructure/billing-api", () => ({
  listAdminInvoices: vi.fn(),
  getBillingSummary: vi.fn(),
}));

import {
  getBillingSummary,
  listAdminInvoices,
  type AdminInvoiceListItem,
} from "@/modules/admin/infrastructure/billing-api";
import {
  OVERDUE_INVOICE,
  PAID_INVOICE,
  SUMMARY,
} from "@/modules/admin/application/billing.test-fixtures";
import { InvoicesView } from "./invoices-view";

const page = (items: AdminInvoiceListItem[], total = items.length) => ({
  items,
  page: 1,
  pageSize: 20,
  total,
  hasMore: false,
});

function apiError(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("falhou", String(status), config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data: { error: { code, message: code } },
  });
}

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <InvoicesView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBillingSummary).mockResolvedValue(SUMMARY);
  vi.mocked(listAdminInvoices).mockResolvedValue(page([OVERDUE_INVOICE, PAID_INVOICE]));
});

describe("InvoicesView — indicadores", () => {
  it("seis cards com `meta` (a conta) e `help` (a fonte), e o 'Ver a conta' com conta e fonte", async () => {
    renderView();

    expect(await screen.findByText("A receber: faturas a vencer")).toBeInTheDocument();
    expect(screen.getByText("R$ 3.412,90")).toBeInTheDocument();
    expect(screen.getByText("4 faturas · a próxima vence seg 26/10")).toBeInTheDocument();
    expect(screen.getByLabelText("Sobre: Vencido")).toHaveAttribute(
      "title",
      "Faturas emitidas, não pagas, com vencimento antes de hoje.",
    );
    expect(screen.getByText("1 fatura · 1 empresa · a mais antiga há 1 dia")).toBeInTheDocument();
    // Empresas bloqueadas é contagem de empresas, não dinheiro.
    const blocked = screen.getByTestId("kpi-blockedCompanies");
    expect(within(blocked).getByText("0")).toBeInTheDocument();
    expect(within(blocked).getByText("R$ 0,00 em faturas bloqueadas")).toBeInTheDocument();
    expect(screen.getByText("Recebido no período")).toBeInTheDocument();
    expect(screen.getByText("Ainda não faturado")).toBeInTheDocument();
    expect(
      screen.getByText("Adiantado aos freelancers, ainda não recebido"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Ver a conta")).toHaveLength(6);
    const advanced = screen.getByTestId("kpi-advanced");
    expect(advanced).toHaveTextContent(
      "Conta: repasses pagos em vagas faturadas R$ 9.000,00 (40) − já cobertos por fatura paga R$ 3.768,30 (10) = R$ 5.231,70",
    );
    expect(advanced).toHaveTextContent(
      "Fonte: Repasses concluídos de vagas com pagamento faturado (INVOICE).",
    );
    expect(screen.queryByText(/profissiona/)).not.toBeInTheDocument();
  });

  it("linha 'A receber no total = a vencer + vencido + ainda não faturado = …'", async () => {
    renderView();

    expect(
      await screen.findByText(
        "A receber no total = a vencer R$ 3.412,90 + vencido R$ 1.248,60 + ainda não faturado R$ 2.105,40 = R$ 6.766,90.",
      ),
    ).toBeInTheDocument();
  });

  it("alerta de pagamento em dobro com link para a fatura", async () => {
    vi.mocked(getBillingSummary).mockResolvedValue({
      ...SUMMARY,
      doublePayments: {
        count: 1,
        text: "1 pagamento em dobro em outubro/2026 para devolver: FAT-2026-000123 (Bar do Zé).",
        calc: "",
        source: "",
        latest: [
          {
            invoiceId: "inv-123",
            number: "FAT-2026-000123",
            companyName: "Bar do Zé",
            at: "2026-10-21T12:00:00.000Z",
          },
        ],
      },
    });
    renderView();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "1 pagamento em dobro em outubro/2026 para devolver: FAT-2026-000123 (Bar do Zé).",
    );
    expect(within(alert).getByRole("link", { name: "Ver FAT-2026-000123" })).toHaveAttribute(
      "href",
      "/financeiro/faturas/inv-123",
    );
  });
});

describe("InvoicesView — filtros e lista", () => {
  it("chips `aria-pressed` com a contagem no texto ('Vencidas, 1')", async () => {
    renderView();

    const chips = await screen.findByRole("group", { name: "Situação" });
    const all = within(chips).getByRole("button", { name: /^Todas/ });
    expect(all).toHaveAttribute("aria-pressed", "true");
    // A contagem de "Vencidas" vem do indicador "Vencido" (count), que é exato.
    const overdue = await within(chips).findByRole("button", { name: "Vencidas, 1" });
    expect(overdue).toHaveAttribute("aria-pressed", "false");

    vi.mocked(listAdminInvoices).mockResolvedValue(page([OVERDUE_INVOICE]));
    fireEvent.click(overdue);

    await waitFor(() =>
      expect(listAdminInvoices).toHaveBeenLastCalledWith(
        expect.objectContaining({ situation: "VENCIDA", page: 1 }),
      ),
    );
    expect(within(chips).getByRole("button", { name: "Vencidas, 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("tabela com `caption` e `aria-sort`; no celular, cartões", async () => {
    renderView();

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Faturas, todas as situações")).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Vence" })).not.toHaveAttribute(
      "aria-sort",
    );
    const row = within(table).getByText("FAT-2026-000123").closest("tr") as HTMLElement;
    expect(within(row).getByRole("link", { name: "FAT-2026-000123" })).toHaveAttribute(
      "href",
      "/financeiro/faturas/inv-123",
    );
    expect(within(row).getByText("09/10 a 15/10")).toBeInTheDocument();
    expect(within(row).getByText("Bar do Zé")).toBeInTheDocument();
    expect(within(row).getByText("Faturado semanal")).toBeInTheDocument();
    expect(within(row).getByText("R$ 1.248,60")).toBeInTheDocument();
    expect(within(row).getByText("seg 19/10")).toBeInTheDocument();
    expect(within(row).getByText("Vencida há 1 dia")).toBeInTheDocument();
    expect(within(row).getByText("D+1 · 20/10 09:00 · Sistema")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Vencidas, 1" }));
    await waitFor(() =>
      expect(within(screen.getByRole("table")).getByText("Faturas, filtradas por: Vencidas, a mais atrasada primeiro")).toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole("table")).getByRole("columnheader", { name: "Vence" }),
    ).toHaveAttribute("aria-sort", "ascending");

    const cards = within(screen.getByTestId("data-table-cards"));
    expect(cards.getAllByRole("listitem")).toHaveLength(2);
  });

  it("busca por empresa (nome ou CNPJ), ciclo e fechamento vão para a API", async () => {
    renderView();
    await screen.findByRole("table");

    fireEvent.change(screen.getByPlaceholderText("Buscar empresa (nome ou CNPJ)"), {
      target: { value: "12.345.678" },
    });
    fireEvent.change(screen.getByLabelText("Ciclo"), { target: { value: "INVOICED_7" } });
    fireEvent.change(screen.getByLabelText("Fechamento de"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Fechamento até"), { target: { value: "2026-10-31" } });

    await waitFor(() =>
      expect(listAdminInvoices).toHaveBeenLastCalledWith({
        situation: undefined,
        mode: "INVOICED_7",
        search: "12.345.678",
        closedFrom: "2026-10-01",
        closedTo: "2026-10-31",
        page: 1,
      }),
    );
  });
});

describe("InvoicesView — estados", () => {
  it("carregando: esqueleto da tabela", () => {
    vi.mocked(listAdminInvoices).mockReturnValue(new Promise(() => {}));
    vi.mocked(getBillingSummary).mockReturnValue(new Promise(() => {}));
    renderView();

    expect(screen.getAllByLabelText("Carregando").length).toBeGreaterThan(0);
  });

  it("vazio com filtro: 'Nenhuma fatura nesta situação.' e 'Limpar filtros'", async () => {
    renderView();
    await screen.findByRole("table");
    vi.mocked(listAdminInvoices).mockResolvedValue(page([]));

    fireEvent.click(screen.getByRole("button", { name: /^Canceladas/ }));

    expect(await screen.findAllByText("Nenhuma fatura nesta situação.")).not.toHaveLength(0);
    vi.mocked(listAdminInvoices).mockResolvedValue(page([OVERDUE_INVOICE]));
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Todas/ })).toHaveAttribute("aria-pressed", "true"),
    );
  });

  it("vazio total: 'Nenhuma empresa no faturado ainda. Ligue em Empresas > Documentos e cobrança.'", async () => {
    vi.mocked(listAdminInvoices).mockResolvedValue(page([]));
    renderView();

    expect(
      await screen.findByText(
        "Nenhuma empresa no faturado ainda. Ligue em Empresas > Documentos e cobrança.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("erro: 'Não conseguimos carregar as faturas.' com 'Tentar de novo'", { timeout: 10000 }, async () => {
    vi.mocked(listAdminInvoices).mockRejectedValue(apiError(500, "INTERNAL_SERVER_ERROR"));
    renderView();

    // 5xx tenta de novo duas vezes antes de mostrar o erro.
    expect(
      await screen.findByText("Não conseguimos carregar as faturas.", {}, { timeout: 6000 }),
    ).toBeInTheDocument();
    vi.mocked(listAdminInvoices).mockResolvedValue(page([OVERDUE_INVOICE]));
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("404 (API do faturamento fora do ar): aviso calmo, sem erro", async () => {
    vi.mocked(listAdminInvoices).mockRejectedValue(apiError(404, "NOT_FOUND"));
    vi.mocked(getBillingSummary).mockRejectedValue(apiError(404, "NOT_FOUND"));
    renderView();

    expect(
      await screen.findByText("As faturas ainda não estão disponíveis neste ambiente."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Não conseguimos carregar as faturas.")).not.toBeInTheDocument();
  });

  it("paginação: 'Página 1 de 2 · 21 faturas' e 'Próxima' pede a página 2", async () => {
    vi.mocked(listAdminInvoices).mockResolvedValue({ ...page([OVERDUE_INVOICE], 21), hasMore: true });
    renderView();

    expect(await screen.findByText("Página 1 de 2 · 21 faturas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() =>
      expect(listAdminInvoices).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
    );
  });
});

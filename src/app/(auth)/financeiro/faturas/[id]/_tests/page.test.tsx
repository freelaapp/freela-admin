import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "inv-123" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("@/modules/admin/infrastructure/billing-api", () => ({
  getAdminInvoice: vi.fn(),
  downloadAdminInvoicePdf: vi.fn(),
  getBillingSummary: vi.fn(),
}));

import { DETAIL, SUMMARY } from "@/modules/admin/application/billing.test-fixtures";
import {
  downloadAdminInvoicePdf,
  getAdminInvoice,
  getBillingSummary,
} from "@/modules/admin/infrastructure/billing-api";
import InvoiceDetailPage from "../page";

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

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <InvoiceDetailPage />
    </QueryClientProvider>,
  );
}

const section = (name: string) => screen.getByRole("region", { name });

/** O indicador de empresas bloqueadas diz se o bloqueio por atraso está ligado. */
const summaryWithBlock = (blockEnabled: boolean) => ({
  ...SUMMARY,
  cards: {
    ...SUMMARY.cards,
    blockedCompanies: { ...SUMMARY.cards.blockedCompanies, blockEnabled },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminInvoice).mockResolvedValue(DETAIL);
  vi.mocked(getBillingSummary).mockResolvedValue(summaryWithBlock(true));
});

describe("Detalhe da fatura", () => {
  it("cabeçalho com período, fechamento, vencimento e bloqueio", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "FAT-2026-000123 · Bar do Zé" }),
    ).toBeInTheDocument();
    expect(getAdminInvoice).toHaveBeenCalledWith("inv-123");
    expect(screen.getByRole("link", { name: "Faturas" })).toHaveAttribute(
      "href",
      "/financeiro?aba=faturas",
    );
    expect(screen.getByText("Vencida há 1 dia")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Faturado semanal · Serviços de sex 09/10 a qui 15/10/2026 · Fechada em sex 16/10 às 08:00",
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Vencimento: seg 19/10/2026 · Bloqueio a partir de sex 23/10 às 00:00"),
    ).toBeInTheDocument();
  });

  it("bloqueio por atraso desligado: diz que está desligado e quando bloquearia", async () => {
    vi.mocked(getBillingSummary).mockResolvedValue(summaryWithBlock(false));
    renderPage();

    expect(
      await screen.findByText(
        "Vencimento: seg 19/10/2026 · Bloqueio por atraso desligado; se ligar, bloquearia a partir de sex 23/10 às 00:00",
      ),
    ).toBeInTheDocument();
  });

  it("sem saber a chave (indicadores com erro): só a data, sem afirmar nada do bloqueio ligado", async () => {
    vi.mocked(getBillingSummary).mockRejectedValue(new Error("rede"));
    renderPage();

    expect(
      await screen.findByText("Vencimento: seg 19/10/2026 · Data do bloqueio na fatura: sex 23/10 às 00:00"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Bloqueio a partir de/)).not.toBeInTheDocument();
  });

  it("total com a conta e o tomador fotografado", async () => {
    renderPage();

    const total = await screen.findByRole("region", { name: "Total" });
    expect(within(total).getByText("R$ 1.248,60")).toBeInTheDocument();
    expect(total).toHaveTextContent(
      "Conta: 12 serviços + 2 horas adicionais = R$ 1.352,64 − créditos R$ 104,04 = R$ 1.248,60",
    );
    expect(total).toHaveTextContent(
      "Tomador (na data do fechamento): Bar do Zé Ltda · CNPJ 12.345.678/0001-90 · Rua X, 100 · Centro · Juiz de Fora/MG · CEP 36000-000 · contas@bardoze.com.br",
    );
  });

  it("cobranças Pix com tentativa e situação", async () => {
    renderPage();

    const charges = await screen.findByRole("region", { name: "Cobranças Pix" });
    expect(charges).toHaveTextContent(
      "1ª · criada 16/10 08:00 por Sistema · vencimento seg 19/10 · pagável até 17/12 23:59 · Pendente",
    );
    expect(within(charges).getByRole("button", { name: "Copiar código Pix" })).toBeInTheDocument();
    expect(within(charges).getByRole("link", { name: "Abrir link de pagamento" })).toHaveAttribute(
      "href",
      "https://woovi.com/pay/abc",
    );
  });

  it("linhas com conta e fonte", async () => {
    renderPage();

    const lines = await screen.findByRole("region", { name: "Linhas (3)" });
    const service = within(lines).getByText("Garçom · Ana Souza").closest("li") as HTMLElement;
    expect(service).toHaveTextContent("09/10");
    expect(service).toHaveTextContent("R$ 124,81");
    expect(service).toHaveTextContent("Conta: 95,00 + 24,96 + 3,00 + 1,85 = 124,81");
    expect(service).toHaveTextContent("taxa de intermediação: 95,00 × 26,27% = 24,96");
    expect(service).toHaveTextContent(
      "Fonte: vaga #ab12cd34, aprovada em 08/10 19:02 por Ana; presença confirmada",
    );
    expect(within(lines).getByText("Hora adicional · Garçom · +2 h")).toBeInTheDocument();
    const credit = within(lines)
      .getByText("Crédito: serviço encerrado antes da hora")
      .closest("li") as HTMLElement;
    expect(credit).toHaveTextContent("− R$ 52,02");
  });

  it("em conferência", async () => {
    renderPage();

    expect(
      await screen.findByText(
        "Em conferência (3): 3 serviços de 14 e 15/10 ainda estão em conferência de presença. Entram na próxima fatura quando forem confirmados.",
      ),
    ).toBeInTheDocument();
  });

  it("mensagens com passo, quando, quem e canais", async () => {
    renderPage();

    const messages = await screen.findByRole("region", { name: "Mensagens de cobrança" });
    const table = within(messages).getByRole("table");
    const resend = within(table).getByText("Reenvio").closest("tr") as HTMLElement;
    const cells = within(resend).getAllByRole("cell").map((c) => c.textContent);
    expect(cells).toEqual([
      "Reenvionota: \"cliente pediu de novo por telefone\"",
      "20/10 14:10",
      "Maria Souza",
      "—",
      "enviado",
      "não enviado (WhatsApp ainda não ligado)",
    ]);
    // No celular, a mesma informação em cartões.
    const cards = within(messages).getByTestId("messages-cards");
    expect(within(cards).getAllByRole("listitem")).toHaveLength(2);
    expect(section("Histórico de ações")).toHaveTextContent(
      'Reenvio da cobrança · 20/10 14:10 · Maria Souza · Motivo: "cliente pediu de novo por telefone"',
    );
  });

  it("faixa vermelha de pagamento em dobro", async () => {
    vi.mocked(getAdminInvoice).mockResolvedValue({
      ...DETAIL,
      alerts: [
        {
          code: "DOUBLE_PAYMENT",
          at: "2026-10-21T12:00:00.000Z",
          text: "Pagamento em dobro em 21/10: entrou um Pix com a fatura já baixada manualmente. Devolva o valor ao cliente.",
          note: "Pix de R$ 1.248,60",
        },
      ],
    });
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Pagamento em dobro em 21/10: entrou um Pix com a fatura já baixada manualmente. Devolva o valor ao cliente.",
    );
    expect(alert).toHaveTextContent("Pix de R$ 1.248,60");
  });

  it("PDF baixa pelo cliente autenticado (com o token)", async () => {
    const createObjectURL = vi.fn(() => "blob:fatura");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    vi.mocked(downloadAdminInvoicePdf).mockResolvedValue(new Blob(["%PDF"]));
    renderPage();

    // O link é clicado; o resto do código síncrono roda; só depois a URL é liberada.
    let revokedSynchronously: boolean | null = null;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      queueMicrotask(() => {
        revokedSynchronously = revokeObjectURL.mock.calls.length > 0;
      });
    });
    fireEvent.click(await screen.findByRole("button", { name: "Baixar PDF" }));

    await waitFor(() => expect(downloadAdminInvoicePdf).toHaveBeenCalledWith("inv-123"));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:fatura"));
    expect(click).toHaveBeenCalled();
    expect(revokedSynchronously).toBe(false);
    click.mockRestore();
  });

  it("404: 'Fatura não encontrada.' com o caminho de volta", async () => {
    vi.mocked(getAdminInvoice).mockRejectedValue(apiError(404, "INVOICE_NOT_FOUND"));
    renderPage();

    expect(await screen.findByText("Fatura não encontrada.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Faturas" })).toBeInTheDocument();
  });
});

describe("Detalhe da fatura — chaves das listas", () => {
  it("dois passos iguais no mesmo instante não repetem a chave", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const same = DETAIL.history[1];
    vi.mocked(getAdminInvoice).mockResolvedValue({
      ...DETAIL,
      history: [...DETAIL.history, same],
      auditTrail: [...DETAIL.auditTrail, DETAIL.auditTrail[0]],
    });
    renderPage();

    const messages = await screen.findByRole("region", { name: "Mensagens de cobrança" });
    expect(within(within(messages).getByRole("table")).getAllByText("Reenvio")).toHaveLength(2);
    expect(
      errors.mock.calls.some((call) => String(call[0]).includes("same key")),
    ).toBe(false);
    errors.mockRestore();
  });
});

import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  type AdminInvoiceDetail,
  type AdminInvoiceNfse,
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

// ─── Nota fiscal da fatura (AD2c.2; API-3g) ──────────────────────────────────

/** A FAT-2026-000123 paga por Pix em seg 26/10 (fechada sex 16/10). */
const PAID: AdminInvoiceDetail = {
  ...DETAIL,
  invoice: {
    ...DETAIL.invoice,
    status: "PAID",
    paidAt: "2026-10-26T12:00:00.000Z",
    paidVia: "PIX",
    paidAmountInCents: 124860,
  },
  situation: { code: "PAGA", label: "Paga em 26/10", overdueDays: 0, waivedUntil: null },
  report: {
    ...DETAIL.report,
    header: { ...DETAIL.report.header, status: "Paga", statusCode: "PAID" },
  },
};

const NOTE: AdminInvoiceNfse = {
  status: "ISSUED",
  number: "123",
  pdfUrl: "https://nfse.example/123.pdf",
  issuedAt: "2026-10-26T13:15:00.000Z",
  amountInCents: 4240,
  competenceDate: "2026-10-16",
  calc: "24,96 + (24,96 − cupom PROMO10 20,00 = 4,96) + 12,48 (encerrado mais cedo: taxa proporcional) = 42,40",
  source: "Taxa de intermediação de cada serviço desta fatura.",
  failureReason: null,
  retryUntil: null,
  nextRetryAt: null,
};

const FAILED_NOTE: AdminInvoiceNfse = {
  ...NOTE,
  status: "FAILED",
  number: null,
  pdfUrl: null,
  issuedAt: null,
  failureReason: "Inscrição municipal do prestador inválida",
  retryUntil: "2026-11-09",
  nextRetryAt: "2026-10-26T14:20:00.000Z",
};

const withNote = (nfse: AdminInvoiceNfse | null, base: AdminInvoiceDetail = PAID) => {
  vi.mocked(getAdminInvoice).mockResolvedValue({ ...base, nfse });
};

const noteSection = () => screen.findByRole("region", { name: "Nota fiscal (NFS-e)" });

describe("Detalhe da fatura — nota fiscal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("bloco 'Nota fiscal' com número, valor, competência, conta (meta) e fonte (help)", async () => {
    withNote(NOTE);
    renderPage();

    const note = await noteSection();
    expect(note).toHaveTextContent("Emitida em seg 26/10 às 10:15");
    expect(note).toHaveTextContent(
      "Nota fiscal nº 123 · R$ 42,40 · competência 16/10/2026 (data de fechamento da fatura)",
    );
    expect(note).toHaveTextContent(
      "Conta: 24,96 + (24,96 − cupom PROMO10 20,00 = 4,96) + 12,48 (encerrado mais cedo: taxa proporcional) = 42,40",
    );
    expect(note).toHaveTextContent("Fonte: Taxa de intermediação de cada serviço desta fatura.");
    // A regra da nota: uma por fatura, a base, a competência e o tomador.
    expect(note).toHaveTextContent("Uma nota por fatura");
    expect(note).toHaveTextContent("menos cupom e estorno parcial automático");
    expect(note).toHaveTextContent("o valor do freelancer, o seguro e a taxa Pix não entram");
    expect(note).toHaveTextContent("Tomador: dados da empresa no fechamento");
    const pdf = within(note).getByRole("link", { name: /Abrir PDF da nota/ });
    expect(pdf).toHaveAttribute("href", "https://nfse.example/123.pdf");
    expect(pdf).toHaveAttribute("target", "_blank");
    expect(pdf.getAttribute("rel")).toContain("noopener");
    expect(pdf).toHaveAccessibleName(/abre em nova aba/);
    expect(within(note).queryByRole("button", { name: /Reemitir/ })).not.toBeInTheDocument();
    expect(note).not.toHaveTextContent(/profissional/i);
  });

  it("emitida sem o PDF ainda: diz que a prefeitura devolve o link depois", async () => {
    withNote({ ...NOTE, pdfUrl: null });
    renderPage();

    const note = await noteSection();
    expect(note).toHaveTextContent("Nota fiscal nº 123");
    expect(within(note).queryByRole("link")).not.toBeInTheDocument();
    expect(note).toHaveTextContent("O PDF ainda não está disponível");
  });

  it("FAILED com o motivo, a próxima tentativa automática (Brasília) e a regra na fonte; sem 'Reemitir'", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-26T13:30:00.000Z"));
    withNote(FAILED_NOTE);
    renderPage();

    const note = await noteSection();
    expect(note).toHaveTextContent("Com problema");
    expect(note).toHaveTextContent(
      "R$ 42,40 · competência 16/10/2026 (data de fechamento da fatura)",
    );
    expect(note).toHaveTextContent("Motivo: Inscrição municipal do prestador inválida");
    expect(note).toHaveTextContent("Próxima tentativa automática: 26/10, 11:20 (Brasília)");
    expect(note).toHaveTextContent(
      "Fonte: reenvio automático da nota da fatura: até 6 reenvios, na varredura dos 20 min de cada hora, com espera mínima de 1 h, 3 h, 6 h, 12 h, 24 h e 24 h depois do envio anterior (o 1º conta da criação da nota), só nos 14 dias depois do pagamento (até 09/11). Tomador sem CPF/CNPJ não é reenviado. A nota da fatura não tem reemissão manual.",
    );
    expect(note).toHaveTextContent("Conta: 24,96 + (24,96 − cupom PROMO10 20,00 = 4,96)");
    expect(note).not.toHaveTextContent("tenta de novo por 14 dias");
    expect(within(note).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reemitir/ })).not.toBeInTheDocument();
  });

  it("FAILED com a hora do reenvio já passada: sai na próxima varredura", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-26T14:30:00.000Z"));
    withNote(FAILED_NOTE);
    renderPage();

    const note = await noteSection();
    expect(note).toHaveTextContent(
      "Próxima tentativa automática: na próxima varredura (aos 20 min de cada hora)",
    );
    expect(note).not.toHaveTextContent("26/10, 11:20");
  });

  it("FAILED sem reenvio (retryUntil null): sem nova tentativa automática, falar com tecnologia", async () => {
    withNote({ ...FAILED_NOTE, failureReason: "Tomador sem CPF/CNPJ", retryUntil: null, nextRetryAt: null });
    renderPage();

    const note = await noteSection();
    expect(note).toHaveTextContent("Motivo: Tomador sem CPF/CNPJ");
    expect(note).toHaveTextContent("Sem nova tentativa automática. Fale com o time de tecnologia.");
    expect(note).toHaveTextContent(
      "Fonte: os reenvios automáticos acabaram (6 reenvios feitos, ou falha que reenviar não resolve, como tomador sem CPF/CNPJ). A nota da fatura não tem reemissão manual.",
    );
    expect(note).not.toHaveTextContent("Próxima tentativa automática");
  });

  it("FAILED sem motivo informado: diz que a emissora não informou", async () => {
    withNote({ ...FAILED_NOTE, failureReason: null });
    renderPage();

    expect(await noteSection()).toHaveTextContent("Motivo: a emissora não informou o motivo");
  });

  it("PENDING: enviada à prefeitura, com valor, competência e conta", async () => {
    withNote({ ...NOTE, status: "PENDING", number: null, pdfUrl: null, issuedAt: null });
    renderPage();

    const note = await noteSection();
    expect(note).toHaveTextContent("Sendo emitida");
    expect(note).toHaveTextContent("Enviada à prefeitura; aguardando autorização.");
    expect(note).toHaveTextContent("R$ 42,40 · competência 16/10/2026 (data de fechamento da fatura)");
    expect(note).toHaveTextContent("Conta: 24,96 +");
  });

  it("NONE com a conta (taxa líquida zero, nada a emitir)", async () => {
    withNote({
      ...NOTE,
      status: "NONE",
      number: null,
      pdfUrl: null,
      issuedAt: null,
      amountInCents: 0,
      calc: "24,96 − cupom CORTESIA30 30,00 = 0,00",
    });
    renderPage();

    const note = await noteSection();
    expect(note).toHaveTextContent("Sem nota");
    expect(note).toHaveTextContent("Taxa líquida zero: nada a emitir.");
    expect(note).toHaveTextContent("Conta: 24,96 − cupom CORTESIA30 30,00 = 0,00");
    expect(note).toHaveTextContent("Fonte: Taxa de intermediação de cada serviço desta fatura.");
    expect(within(note).queryByRole("link")).not.toBeInTheDocument();
  });

  it("sem nota (null): em aberto, paga e cancelada", async () => {
    withNote(null, DETAIL);
    const first = renderPage();
    expect(await noteSection()).toHaveTextContent(
      "A nota sai quando a fatura for paga ou quitada com crédito.",
    );
    first.unmount();

    withNote(null, PAID);
    const second = renderPage();
    expect(await noteSection()).toHaveTextContent("A nota desta fatura ainda não saiu; sai em seguida.");
    second.unmount();

    withNote(null, {
      ...DETAIL,
      invoice: { ...DETAIL.invoice, status: "CANCELLED" },
      situation: { code: "CANCELADA", label: "Cancelada", overdueDays: 0, waivedUntil: null },
    });
    renderPage();
    expect(await noteSection()).toHaveTextContent("Fatura cancelada: sem nota fiscal.");
  });
});

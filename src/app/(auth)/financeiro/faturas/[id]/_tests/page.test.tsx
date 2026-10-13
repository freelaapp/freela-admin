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
  reissueInvoiceNfse: vi.fn(),
}));

import { toast } from "sonner";
import { DETAIL, SUMMARY } from "@/modules/admin/application/billing.test-fixtures";
import {
  downloadAdminInvoicePdf,
  getAdminInvoice,
  getBillingSummary,
  reissueInvoiceNfse,
  type AdminInvoiceDetail,
  type AdminInvoiceNfse,
} from "@/modules/admin/infrastructure/billing-api";
import InvoiceDetailPage from "../page";

function apiError(status: number, code: string, message = code): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("falhou", String(status), config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data: { error: { code, message } },
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
    // Sem `actions.nfseReissue` (API antiga), nada sobre reemissão.
    expect(note).not.toHaveTextContent("Na reemissão");
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

  it("FAILED com o motivo, a próxima tentativa automática (Brasília) e a regra na fonte; API antiga (sem actions.nfseReissue): sem botão", async () => {
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
      "Fonte: reenvio automático da nota da fatura: até 6 reenvios, na varredura dos 20 min de cada hora, com espera mínima de 1 h, 3 h, 6 h, 12 h, 24 h e 24 h depois do envio anterior (o 1º conta da criação da nota), só nos 14 dias depois do pagamento (até 09/11). Tomador sem CPF/CNPJ não é reenviado.",
    );
    expect(note).toHaveTextContent("Conta: 24,96 + (24,96 − cupom PROMO10 20,00 = 4,96)");
    expect(note).not.toHaveTextContent("tenta de novo por 14 dias");
    // Sem o botão, o texto não aponta para ele nem afirma que não há reemissão.
    expect(note).not.toHaveTextContent(/Reemitir|reemissão manual/);
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
      "Fonte: os reenvios automáticos acabaram (6 reenvios feitos, ou falha que reenviar não resolve, como tomador sem CPF/CNPJ).",
    );
    expect(note).not.toHaveTextContent("Próxima tentativa automática");
    expect(note).not.toHaveTextContent(/Reemitir|reemissão manual/);
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

  it("valor e competência malformados: '—' (nunca R$ 0,00), com a situação da nota visível", async () => {
    withNote({ ...NOTE, amountInCents: null, competenceDate: null });
    renderPage();

    const note = await noteSection();
    expect(note).toHaveTextContent("Emitida em seg 26/10 às 10:15");
    expect(note).toHaveTextContent("Nota fiscal nº 123 · — · competência —");
    expect(note).not.toHaveTextContent("R$ 0,00");
    expect(note).not.toHaveTextContent("competência  (");
  });

  it("FAILED com valor malformado: '—' e a situação 'Com problema' continua", async () => {
    withNote({ ...FAILED_NOTE, amountInCents: null, competenceDate: "23/10/2026" });
    renderPage();

    const note = await noteSection();
    expect(note).toHaveTextContent("Com problema");
    expect(note).toHaveTextContent("— · competência —");
    expect(note).not.toHaveTextContent("R$ 0,00");
    expect(note).not.toHaveTextContent("23/10/2026");
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

// ─── Reemitir a nota fiscal recusada ────────────────────────────────────────

/** A nota recusada depois dos reenvios automáticos, com o "Reemitir nota" ligado. */
const REFUSED_NOTE: AdminInvoiceNfse = {
  ...FAILED_NOTE,
  failureReason: "Telefone do tomador inválido",
  retryUntil: null,
  nextRetryAt: null,
};

const REISSUABLE: AdminInvoiceDetail = {
  ...PAID,
  nfse: REFUSED_NOTE,
  actions: { ...PAID.actions, nfseReissue: { enabled: true, reason: null } },
};

/** Depois da reemissão: a nota de novo na prefeitura e a ação na trilha. */
const AFTER_REISSUE: AdminInvoiceDetail = {
  ...REISSUABLE,
  nfse: { ...NOTE, status: "PENDING", number: null, pdfUrl: null, issuedAt: null },
  actions: {
    ...REISSUABLE.actions,
    nfseReissue: { enabled: false, reason: "A nota não está recusada." },
  },
  auditTrail: [
    ...PAID.auditTrail,
    {
      action: "NFSE_REISSUE",
      label: "Reemitiu a nota fiscal",
      at: "2026-10-27T13:00:00.000Z",
      by: "João Lima",
      reason: "Telefone corrigido no cadastro",
      before: {},
      after: {},
    },
  ],
};

const REISSUE_TITLE = "Reemitir a nota fiscal da fatura FAT-2026-000123";
const REISSUE_TEXT =
  "A nota vai de novo para a prefeitura com os dados ATUAIS da empresa (razão social, CNPJ, endereço, telefone e e-mail). A fatura não muda. Se a recusa foi por dado errado, corrija o cadastro da empresa antes de reemitir.";

const reissueDialog = () => screen.getByRole("dialog", { name: REISSUE_TITLE });
const reissueReason = () => within(reissueDialog()).getByLabelText("Motivo (obrigatório)");

/** Abre o diálogo pelo quadro da nota e escreve o motivo. */
async function openReissue(reason = "Telefone corrigido no cadastro") {
  const note = await noteSection();
  fireEvent.click(within(note).getByRole("button", { name: "Reemitir nota" }));
  fireEvent.change(reissueReason(), { target: { value: reason } });
  return note;
}

describe("Detalhe da fatura — Reemitir nota", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("API antiga (sem actions.nfseReissue): sem o botão, mesmo com a nota recusada", async () => {
    withNote(REFUSED_NOTE);
    renderPage();

    const note = await noteSection();
    expect(note).toHaveTextContent("Com problema");
    expect(within(note).queryByRole("button", { name: "Reemitir nota" })).not.toBeInTheDocument();
  });

  it("nota emitida ou na prefeitura: sem o botão (só aparece com a nota recusada)", async () => {
    vi.mocked(getAdminInvoice).mockResolvedValue({
      ...AFTER_REISSUE,
      auditTrail: PAID.auditTrail,
    });
    renderPage();

    const note = await noteSection();
    expect(note).toHaveTextContent("Enviada à prefeitura; aguardando autorização.");
    expect(within(note).queryByRole("button", { name: "Reemitir nota" })).not.toBeInTheDocument();
    expect(note).not.toHaveTextContent("Reemitir nota: A nota não está recusada.");
  });

  it("desabilitado pela API: o botão fica cinza e o porquê aparece embaixo", async () => {
    vi.mocked(getAdminInvoice).mockResolvedValue({
      ...REISSUABLE,
      actions: {
        ...REISSUABLE.actions,
        nfseReissue: { enabled: false, reason: "Os reenvios automáticos ainda estão em andamento." },
      },
    });
    renderPage();

    const note = await noteSection();
    const button = within(note).getByRole("button", { name: "Reemitir nota" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      "Reemitir nota: Os reenvios automáticos ainda estão em andamento.",
    );
    expect(note).toHaveTextContent("Reemitir nota: Os reenvios automáticos ainda estão em andamento.");
  });

  it("habilitado: o quadro aponta para o botão e o diálogo mostra a recusa e os dados atuais", async () => {
    vi.mocked(getAdminInvoice).mockResolvedValue(REISSUABLE);
    renderPage();

    const note = await noteSection();
    expect(note).toHaveTextContent(
      'Sem nova tentativa automática. Se o motivo for dado errado, corrija o cadastro da empresa e use "Reemitir nota".',
    );
    expect(note).toHaveTextContent(
      'Fonte: os reenvios automáticos acabaram (6 reenvios feitos, ou falha que reenviar não resolve, como tomador sem CPF/CNPJ). O caminho agora é o botão "Reemitir nota", com os dados atuais da empresa.',
    );
    expect(note).not.toHaveTextContent("Fale com o time de tecnologia");
    // A regra da nota diz que a reemissão usa os dados atuais (não os do fechamento).
    expect(note).toHaveTextContent(
      'Tomador: dados da empresa no fechamento. Número e PDF: da prefeitura, na autorização. Na reemissão ("Reemitir nota"), o tomador sai com os dados atuais da empresa.',
    );
    const button = within(note).getByRole("button", { name: "Reemitir nota" });
    expect(button).toBeEnabled();
    // No celular, largura toda.
    expect(button).toHaveClass("w-full", "sm:w-auto");
    fireEvent.click(button);

    const dialog = reissueDialog();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("Motivo da recusa da prefeitura");
    expect(dialog).toHaveTextContent("Telefone do tomador inválido");
    expect(within(dialog).getByText(REISSUE_TEXT)).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(/profissional/i);
    // O painel rola (celular): o conteúdo não passa da tela.
    expect(dialog).toHaveClass("overflow-y-auto");
  });

  it("nota recusada ainda com reenvio automático: a regra aponta para o botão depois dos reenvios", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-26T13:30:00.000Z"));
    vi.mocked(getAdminInvoice).mockResolvedValue({ ...REISSUABLE, nfse: FAILED_NOTE });
    renderPage();

    const note = await noteSection();
    expect(note).toHaveTextContent(
      'Tomador sem CPF/CNPJ não é reenviado. Depois dos reenvios automáticos, o caminho é o botão "Reemitir nota".',
    );
    expect(note).toHaveTextContent("Próxima tentativa automática: 26/10, 11:20 (Brasília)");
  });

  it("motivo com menos de 5 caracteres: o botão do diálogo não envia", async () => {
    vi.mocked(getAdminInvoice).mockResolvedValue(REISSUABLE);
    renderPage();
    await openReissue("abcd");

    const submit = within(reissueDialog()).getByRole("button", { name: "Reemitir nota" });
    expect(submit).toBeDisabled();
    expect(reissueReason()).toHaveAccessibleDescription("Escreva o motivo (pelo menos 5 caracteres).");
    fireEvent.click(submit);
    expect(reissueInvoiceNfse).not.toHaveBeenCalled();

    fireEvent.change(reissueReason(), { target: { value: "abcde" } });
    expect(submit).toBeEnabled();
  });

  it("PENDING: envia o motivo, toast de enviada e recarrega o quadro e o histórico", async () => {
    vi.mocked(getAdminInvoice).mockResolvedValue(REISSUABLE);
    vi.mocked(reissueInvoiceNfse).mockResolvedValue({
      status: "PENDING",
      number: null,
      failureReason: null,
    });
    renderPage();
    await openReissue("  Telefone corrigido no cadastro  ");
    vi.mocked(getAdminInvoice).mockResolvedValue(AFTER_REISSUE);
    fireEvent.click(within(reissueDialog()).getByRole("button", { name: "Reemitir nota" }));

    await waitFor(() =>
      expect(reissueInvoiceNfse).toHaveBeenCalledWith("inv-123", {
        reason: "Telefone corrigido no cadastro",
      }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Nota enviada à prefeitura. A resposta chega em alguns minutos.",
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // O detalhe é lido de novo: a nota "Sendo emitida" e a ação na trilha.
    await waitFor(() => expect(getAdminInvoice).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Enviada à prefeitura; aguardando autorização.")).toBeInTheDocument();
    expect(section("Histórico de ações")).toHaveTextContent(
      'Reemitiu a nota fiscal · 27/10 10:00 · João Lima · Motivo: "Telefone corrigido no cadastro"',
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("ISSUED: 'Nota emitida' com o número e recarrega", async () => {
    vi.mocked(getAdminInvoice).mockResolvedValue(REISSUABLE);
    vi.mocked(reissueInvoiceNfse).mockResolvedValue({
      status: "ISSUED",
      number: "456",
      failureReason: null,
    });
    renderPage();
    await openReissue();
    fireEvent.click(within(reissueDialog()).getByRole("button", { name: "Reemitir nota" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Nota emitida: nº 456."));
    await waitFor(() => expect(getAdminInvoice).toHaveBeenCalledTimes(2));
  });

  it("ISSUED sem número: só 'Nota emitida.'", async () => {
    vi.mocked(getAdminInvoice).mockResolvedValue(REISSUABLE);
    vi.mocked(reissueInvoiceNfse).mockResolvedValue({
      status: "ISSUED",
      number: null,
      failureReason: null,
    });
    renderPage();
    await openReissue();
    fireEvent.click(within(reissueDialog()).getByRole("button", { name: "Reemitir nota" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Nota emitida."));
  });

  it("FAILED: toast de erro com o motivo novo, volta ao reenvio automático e recarrega", async () => {
    vi.mocked(getAdminInvoice).mockResolvedValue(REISSUABLE);
    vi.mocked(reissueInvoiceNfse).mockResolvedValue({
      status: "FAILED",
      number: null,
      failureReason: "CEP do tomador não encontrado",
    });
    renderPage();
    await openReissue();
    fireEvent.click(within(reissueDialog()).getByRole("button", { name: "Reemitir nota" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "A prefeitura recusou de novo: CEP do tomador não encontrado",
        { description: "A nota volta ao reenvio automático com os dados novos." },
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(getAdminInvoice).toHaveBeenCalledTimes(2));
  });

  it("erro da API: a mensagem dela no diálogo, que continua aberto; dado velho recarrega a fatura", async () => {
    vi.mocked(getAdminInvoice).mockResolvedValue(REISSUABLE);
    vi.mocked(reissueInvoiceNfse).mockRejectedValue(
      apiError(409, "NFSE_REISSUE_IN_PROGRESS", "Já há uma reemissão desta nota em andamento."),
    );
    renderPage();
    await openReissue();
    fireEvent.click(within(reissueDialog()).getByRole("button", { name: "Reemitir nota" }));

    expect(await within(reissueDialog()).findByRole("alert")).toHaveTextContent(
      "Já há uma reemissão desta nota em andamento.",
    );
    await waitFor(() => expect(getAdminInvoice).toHaveBeenCalledTimes(2));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("erro com código que as irmãs traduzem (FEATURE_DISABLED): vale a mensagem da API", async () => {
    vi.mocked(getAdminInvoice).mockResolvedValue(REISSUABLE);
    vi.mocked(reissueInvoiceNfse).mockRejectedValue(
      apiError(404, "FEATURE_DISABLED", "A emissão de NFS-e por fatura está desligada."),
    );
    renderPage();
    await openReissue();
    fireEvent.click(within(reissueDialog()).getByRole("button", { name: "Reemitir nota" }));

    expect(await within(reissueDialog()).findByRole("alert")).toHaveTextContent(
      "A emissão de NFS-e por fatura está desligada.",
    );
  });

  it("422 TAKER_WITHOUT_DOCUMENT: a mensagem da API, sem recarregar", async () => {
    vi.mocked(getAdminInvoice).mockResolvedValue(REISSUABLE);
    vi.mocked(reissueInvoiceNfse).mockRejectedValue(
      apiError(422, "TAKER_WITHOUT_DOCUMENT", "A empresa está sem CNPJ no cadastro."),
    );
    renderPage();
    await openReissue();
    fireEvent.click(within(reissueDialog()).getByRole("button", { name: "Reemitir nota" }));

    expect(await within(reissueDialog()).findByRole("alert")).toHaveTextContent(
      "A empresa está sem CNPJ no cadastro.",
    );
    expect(getAdminInvoice).toHaveBeenCalledTimes(1);
  });

  it("clique duplo envia uma vez só; enquanto envia, 'Enviando...' travado", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    vi.mocked(getAdminInvoice).mockResolvedValue(REISSUABLE);
    vi.mocked(reissueInvoiceNfse).mockImplementation(
      () => new Promise((resolve) => (resolveFirst = resolve)) as never,
    );
    renderPage();
    await openReissue();
    const submit = within(reissueDialog()).getByRole("button", { name: "Reemitir nota" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(reissueInvoiceNfse).toHaveBeenCalled());
    expect(reissueInvoiceNfse).toHaveBeenCalledTimes(1);
    expect(await within(reissueDialog()).findByRole("button", { name: "Enviando..." })).toBeDisabled();
    expect(within(reissueDialog()).getByRole("button", { name: "Cancelar" })).toBeDisabled();

    resolveFirst({ status: "PENDING", number: null, failureReason: null });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(reissueInvoiceNfse).toHaveBeenCalledTimes(1);
  });
});

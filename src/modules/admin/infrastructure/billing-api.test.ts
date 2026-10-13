import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, post }),
}));

import {
  billingErrorOf,
  closeInvoiceNow,
  createBillingAdjustment,
  downloadAdminInvoicePdf,
  getAdminInvoice,
  getBillingSummary,
  issueSecondCopy,
  listAdminInvoices,
  markInvoicePaid,
  resendInvoice,
  waiveInvoiceBlock,
} from "./billing-api";

function axiosError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("falhou", String(status), config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data,
  });
}

describe("billing-api", () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { data: { ok: true } } });
    post.mockReset().mockResolvedValue({ data: { data: { ok: true } } });
  });

  it("lista com situação, ciclo, busca e período (sem mandar filtro vazio)", async () => {
    get.mockResolvedValueOnce({
      data: {
        data: [{ id: "inv-1" }],
        meta: { page: 2, pageSize: 20, total: 21, hasMore: false },
      },
    });

    const result = await listAdminInvoices({
      situation: "VENCIDA",
      mode: "INVOICED_7",
      search: " 12.345.678/0001-90 ",
      closedFrom: "2026-10-01",
      closedTo: "",
      page: 2,
    });

    expect(get).toHaveBeenCalledWith("/billing/invoices", {
      params: {
        situation: "VENCIDA",
        mode: "INVOICED_7",
        search: "12.345.678/0001-90",
        closedFrom: "2026-10-01",
        page: 2,
      },
    });
    expect(result).toEqual({
      items: [{ id: "inv-1" }],
      page: 2,
      pageSize: 20,
      total: 21,
      hasMore: false,
    });
  });

  it("detalhe, PDF (blob), reenviar, 2ª via, baixa, liberar, ajuste, fechar agora, resumo", async () => {
    await expect(getAdminInvoice("inv 1")).resolves.toEqual({ ok: true, nfse: null });
    expect(get).toHaveBeenLastCalledWith("/billing/invoices/inv%201");

    const pdf = new Blob(["%PDF"], { type: "application/pdf" });
    get.mockResolvedValueOnce({ data: pdf });
    await expect(downloadAdminInvoicePdf("inv-1")).resolves.toBe(pdf);
    expect(get).toHaveBeenLastCalledWith("/billing/invoices/inv-1/pdf", { responseType: "blob" });

    await resendInvoice("inv-1", { reason: " Cliente pediu ", channels: ["email"] });
    expect(post).toHaveBeenLastCalledWith("/billing/invoices/inv-1/resend", {
      reason: "Cliente pediu",
      channels: ["email"],
    });

    await issueSecondCopy("inv-1", { reason: "Código expirou" });
    expect(post).toHaveBeenLastCalledWith("/billing/invoices/inv-1/charges", {
      reason: "Código expirou",
    });

    await markInvoicePaid("inv-1", {
      reason: "Transferência recebida",
      paidAt: "2026-10-20",
      amountInCents: 124860,
    });
    expect(post).toHaveBeenLastCalledWith("/billing/invoices/inv-1/mark-paid", {
      reason: "Transferência recebida",
      paidAt: "2026-10-20",
      amountInCents: 124860,
    });

    await waiveInvoiceBlock("inv-1", { reason: "Cliente vai pagar amanhã", until: "2026-10-25" });
    expect(post).toHaveBeenLastCalledWith("/billing/invoices/inv-1/waive-block", {
      reason: "Cliente vai pagar amanhã",
      until: "2026-10-25",
    });

    await createBillingAdjustment("owner 1", {
      direction: "CREDIT",
      amountInCents: 4860,
      reason: "Desconto combinado",
      vacancyId: "",
      requestId: "7d3c1b9e-2f4a-4c1e-9b7a-1a2b3c4d5e6f",
    });
    expect(post).toHaveBeenLastCalledWith("/billing/contractors/owner%201/adjustments", {
      direction: "CREDIT",
      amountInCents: 4860,
      reason: "Desconto combinado",
      requestId: "7d3c1b9e-2f4a-4c1e-9b7a-1a2b3c4d5e6f",
    });

    await closeInvoiceNow("owner-1", { reason: "Fim do contrato" });
    expect(post).toHaveBeenLastCalledWith("/billing/contractors/owner-1/close-now", {
      reason: "Fim do contrato",
    });

    await getBillingSummary();
    expect(get).toHaveBeenLastCalledWith("/billing/summary", { params: {} });
    await getBillingSummary({ period: "custom", from: "2026-10-01", to: "2026-10-31" });
    expect(get).toHaveBeenLastCalledWith("/billing/summary", {
      params: { period: "custom", from: "2026-10-01", to: "2026-10-31" },
    });
  });

  it("detalhe com nfse e failureReason (o motivo, até quando e a próxima tentativa)", async () => {
    const nfse = {
      status: "FAILED",
      number: null,
      pdfUrl: null,
      issuedAt: null,
      amountInCents: 4240,
      competenceDate: "2026-10-23",
      calc: "24,96 + (24,96 − cupom PROMO10 20,00 = 4,96) + 12,48 = 42,40",
      source: "Taxa de intermediação de cada serviço desta fatura.",
      failureReason: "Inscrição municipal do prestador inválida",
      retryUntil: "2026-11-09",
      nextRetryAt: "2026-10-26T14:20:00.000Z",
    };
    get.mockResolvedValueOnce({ data: { data: { invoice: { id: "inv-1" }, nfse } } });

    await expect(getAdminInvoice("inv-1")).resolves.toEqual({ invoice: { id: "inv-1" }, nfse });
  });

  it("detalhe: nota emitida passa inteira; sem o campo (API anterior) ou com forma estranha vira null", async () => {
    const issued = {
      status: "ISSUED",
      number: "123",
      pdfUrl: "https://nfse.example/123.pdf",
      issuedAt: "2026-10-26T13:15:00.000Z",
      amountInCents: 4240,
      competenceDate: "2026-10-23",
      calc: "24,96 + 4,96 + 12,48 = 42,40",
      source: "Taxa de intermediação de cada serviço desta fatura.",
      failureReason: null,
      retryUntil: null,
      nextRetryAt: null,
    };
    get.mockResolvedValueOnce({ data: { data: { nfse: issued } } });
    await expect(getAdminInvoice("inv-1")).resolves.toEqual({ nfse: issued });

    // Sem os campos do admin (failureReason, retryUntil, nextRetryAt): ficam null.
    const { failureReason, retryUntil, nextRetryAt, ...contractorShape } = issued;
    void failureReason;
    void retryUntil;
    void nextRetryAt;
    get.mockResolvedValueOnce({ data: { data: { nfse: contractorShape } } });
    await expect(getAdminInvoice("inv-1")).resolves.toEqual({ nfse: issued });

    get.mockResolvedValueOnce({ data: { data: { invoice: { id: "inv-1" } } } });
    await expect(getAdminInvoice("inv-1")).resolves.toEqual({ invoice: { id: "inv-1" }, nfse: null });

    get.mockResolvedValueOnce({ data: { data: { nfse: { status: "CANCELLED" } } } });
    await expect(getAdminInvoice("inv-1")).resolves.toEqual({ nfse: null });
  });

  it("detalhe: PDF da nota só com https (javascript:, data: e http: viram null)", async () => {
    const base = {
      status: "ISSUED",
      number: "123",
      issuedAt: "2026-10-26T13:15:00.000Z",
      amountInCents: 4240,
      competenceDate: "2026-10-23",
      calc: "42,40",
      source: "Fonte.",
    };
    for (const pdfUrl of [
      "javascript:alert(1)",
      " JavaScript:alert(document.cookie)",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "http://nfse.example/123.pdf",
      "//nfse.example/123.pdf",
      "não é url",
    ]) {
      get.mockResolvedValueOnce({ data: { data: { nfse: { ...base, pdfUrl } } } });
      const detail = await getAdminInvoice("inv-1");
      expect(detail.nfse?.pdfUrl, pdfUrl).toBeNull();
      expect(detail.nfse?.status).toBe("ISSUED");
    }

    get.mockResolvedValueOnce({
      data: { data: { nfse: { ...base, pdfUrl: "https://nfse.example/123.pdf" } } },
    });
    expect((await getAdminInvoice("inv-1")).nfse?.pdfUrl).toBe("https://nfse.example/123.pdf");
  });

  it("detalhe: valor ou competência malformados viram null (a tela mostra '—'); a situação fica", async () => {
    get.mockResolvedValueOnce({
      data: {
        data: {
          nfse: {
            status: "FAILED",
            amountInCents: "4240",
            competenceDate: "23/10/2026",
            calc: "42,40",
            source: "Fonte.",
          },
        },
      },
    });
    const detail = await getAdminInvoice("inv-1");
    expect(detail.nfse).toMatchObject({ status: "FAILED", amountInCents: null, competenceDate: null });

    for (const [amountInCents, competenceDate] of [
      [Number.NaN, ""],
      [-1, "2026-13"],
      [42.5, null],
    ] as const) {
      get.mockResolvedValueOnce({ data: { data: { nfse: { status: "PENDING", amountInCents, competenceDate } } } });
      expect((await getAdminInvoice("inv-1")).nfse).toMatchObject({
        status: "PENDING",
        amountInCents: null,
        competenceDate: null,
      });
    }
  });

  it("2ª via sem cobrança devolve null", async () => {
    post.mockResolvedValueOnce({ data: { data: null } });
    await expect(issueSecondCopy("inv-1", { reason: "Código expirou" })).resolves.toBeNull();
  });
});

describe("billingErrorOf", () => {
  it("corpo de erro plano vira {status, code, message}", () => {
    expect(
      billingErrorOf(
        axiosError(409, {
          code: "INVOICE_NOT_OPEN",
          message: "Esta fatura já foi paga ou cancelada. Recarregue a página.",
          status: "PAID",
        }),
      ),
    ).toEqual({
      status: 409,
      code: "INVOICE_NOT_OPEN",
      message: "Esta fatura já foi paga ou cancelada. Recarregue a página.",
    });
  });

  it("o corpo do filtro global (`{ error }`) também", () => {
    expect(
      billingErrorOf(
        axiosError(503, {
          error: { code: "CHARGE_PROVIDER_UNAVAILABLE", message: "Cobrança Pix fora do ar." },
        }),
      ),
    ).toEqual({
      status: 503,
      code: "CHARGE_PROVIDER_UNAVAILABLE",
      message: "Cobrança Pix fora do ar.",
    });
    expect(billingErrorOf(new Error("rede"))).toEqual({ status: null, code: null, message: null });
  });
});

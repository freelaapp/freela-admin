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
    await expect(getAdminInvoice("inv 1")).resolves.toEqual({ ok: true });
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

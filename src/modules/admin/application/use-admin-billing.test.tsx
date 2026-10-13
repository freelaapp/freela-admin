import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../infrastructure/billing-api", () => ({
  listAdminInvoices: vi.fn(),
  getAdminInvoice: vi.fn(),
  getBillingSummary: vi.fn(),
  resendInvoice: vi.fn(),
  issueSecondCopy: vi.fn(),
  markInvoicePaid: vi.fn(),
  waiveInvoiceBlock: vi.fn(),
  createBillingAdjustment: vi.fn(),
  closeInvoiceNow: vi.fn(),
}));

import {
  closeInvoiceNow,
  createBillingAdjustment,
  getAdminInvoice,
  issueSecondCopy,
  listAdminInvoices,
  markInvoicePaid,
  resendInvoice,
  waiveInvoiceBlock,
} from "../infrastructure/billing-api";
import {
  billingKeys,
  useAdminInvoice,
  useAdminInvoices,
  useBillingAdjustment,
  useCloseInvoiceNow,
  useIssueSecondCopy,
  useMarkInvoicePaid,
  useResendInvoice,
  useWaiveInvoiceBlock,
} from "./use-admin-billing";

let qc: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/** Lista, detalhe e resumo no cache; depois da ação, os três ficam inválidos. */
function seedCache() {
  qc.setQueryData(billingKeys.list({ situation: "VENCIDA" }), { items: [] });
  qc.setQueryData(billingKeys.detail("inv-1"), { invoice: { id: "inv-1" } });
  qc.setQueryData(billingKeys.summary({}), { cards: {} });
  qc.setQueryData(["admin", "finance", "summary", {}], { entradasCents: 0 });
  qc.setQueryData(["admin", "contractors"], []);
}

function expectAllInvalidated() {
  for (const key of [
    billingKeys.list({ situation: "VENCIDA" }),
    billingKeys.detail("inv-1"),
    billingKeys.summary({}),
    ["admin", "finance", "summary", {}],
    ["admin", "contractors"],
  ]) {
    expect(qc.getQueryState(key)?.isInvalidated).toBe(true);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("use-admin-billing — leituras", () => {
  it("lista com os filtros na chave; detalhe por id", async () => {
    vi.mocked(listAdminInvoices).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      hasMore: false,
    });
    vi.mocked(getAdminInvoice).mockResolvedValue({ invoice: { id: "inv-1" } } as never);

    const list = renderHook(() => useAdminInvoices({ situation: "VENCIDA" }), { wrapper });
    const detail = renderHook(() => useAdminInvoice("inv-1"), { wrapper });

    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));
    expect(listAdminInvoices).toHaveBeenCalledWith({ situation: "VENCIDA" });
    expect(getAdminInvoice).toHaveBeenCalledWith("inv-1");
  });
});

/** Roda a ação e confere que lista, detalhe, resumo, Financeiro e Empresas recarregam. */
async function runAction<TInput>(
  useHook: () => { mutateAsync: (input: TInput) => Promise<unknown> },
  input: TInput,
) {
  seedCache();
  const { result } = renderHook(useHook, { wrapper });
  await act(async () => {
    await result.current.mutateAsync(input);
  });
  await waitFor(expectAllInvalidated);
}

describe("use-admin-billing — cada ação invalida a lista, o detalhe e o resumo", () => {
  it("reenviar", async () => {
    vi.mocked(resendInvoice).mockResolvedValue({ ok: true } as never);
    const input = { reason: "Cliente pediu", channels: ["email" as const] };
    await runAction(() => useResendInvoice("inv-1"), input);
    expect(resendInvoice).toHaveBeenCalledWith("inv-1", input);
  });

  it("2ª via", async () => {
    vi.mocked(issueSecondCopy).mockResolvedValue(null);
    await runAction(() => useIssueSecondCopy("inv-1"), { reason: "Código expirou" });
    expect(issueSecondCopy).toHaveBeenCalledWith("inv-1", { reason: "Código expirou" });
  });

  it("baixa manual", async () => {
    vi.mocked(markInvoicePaid).mockResolvedValue({ ok: true } as never);
    const input = { reason: "Transferência", paidAt: "2026-10-20", amountInCents: 100 };
    await runAction(() => useMarkInvoicePaid("inv-1"), input);
    expect(markInvoicePaid).toHaveBeenCalledWith("inv-1", input);
  });

  it("liberar bloqueio", async () => {
    vi.mocked(waiveInvoiceBlock).mockResolvedValue({ ok: true } as never);
    const input = { reason: "Vai pagar amanhã", until: "2026-10-25" };
    await runAction(() => useWaiveInvoiceBlock("inv-1"), input);
    expect(waiveInvoiceBlock).toHaveBeenCalledWith("inv-1", input);
  });

  it("ajuste", async () => {
    vi.mocked(createBillingAdjustment).mockResolvedValue({ ok: true } as never);
    const input = {
      direction: "CREDIT" as const,
      amountInCents: 100,
      reason: "Desconto",
      requestId: "r-1",
    };
    await runAction(() => useBillingAdjustment("owner-1"), input);
    expect(createBillingAdjustment).toHaveBeenCalledWith("owner-1", input);
  });

  it("fechar agora", async () => {
    vi.mocked(closeInvoiceNow).mockResolvedValue({ ok: true } as never);
    await runAction(() => useCloseInvoiceNow("owner-1"), { reason: "Fim do contrato" });
    expect(closeInvoiceNow).toHaveBeenCalledWith("owner-1", { reason: "Fim do contrato" });
  });
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

/** A ação falha; devolve se lista, detalhe e resumo ficaram inválidos. */
async function failAction<TInput>(
  useHook: () => { mutateAsync: (input: TInput) => Promise<unknown> },
  input: TInput,
) {
  seedCache();
  const { result } = renderHook(useHook, { wrapper });
  await act(async () => {
    await result.current.mutateAsync(input).catch(() => undefined);
  });
}

describe("use-admin-billing — erro de dado velho recarrega a fatura", () => {
  it.each(["INVOICE_NOT_OPEN", "FEATURE_DISABLED"])(
    "%s: lista, detalhe e resumo recarregam (os botões não ficam ligados à toa)",
    async (code) => {
      vi.mocked(markInvoicePaid).mockRejectedValue(apiError(code === "FEATURE_DISABLED" ? 404 : 409, code));
      await failAction(() => useMarkInvoicePaid("inv-1"), { reason: "Transferência" });
      await waitFor(expectAllInvalidated);
    },
  );

  it("NOTHING_TO_INVOICE no 'fechar agora' também recarrega", async () => {
    vi.mocked(closeInvoiceNow).mockRejectedValue(apiError(409, "NOTHING_TO_INVOICE"));
    await failAction(() => useCloseInvoiceNow("owner-1"), { reason: "Fim do contrato" });
    await waitFor(expectAllInvalidated);
  });

  it("erro de campo (REASON_REQUIRED) não recarrega nada", async () => {
    vi.mocked(resendInvoice).mockRejectedValue(apiError(422, "REASON_REQUIRED"));
    await failAction(() => useResendInvoice("inv-1"), { reason: "abc" });
    expect(qc.getQueryState(billingKeys.detail("inv-1"))?.isInvalidated).toBe(false);
    expect(qc.getQueryState(billingKeys.summary({}))?.isInvalidated).toBe(false);
  });
});

"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiErrorOf } from "../infrastructure/api-error";
import {
  closeInvoiceNow,
  createBillingAdjustment,
  getAdminInvoice,
  getBillingSummary,
  issueSecondCopy,
  listAdminInvoices,
  markInvoicePaid,
  resendInvoice,
  waiveInvoiceBlock,
  type AdjustmentInput,
  type AdminInvoiceListParams,
  type ResendChannel,
  type SummaryPeriod,
} from "../infrastructure/billing-api";
import type { DateKey } from "../infrastructure/billing-mode-api";

export const billingKeys = {
  all: ["admin", "billing"] as const,
  list: (params: AdminInvoiceListParams) => ["admin", "billing", "invoices", params] as const,
  detail: (id: string) => ["admin", "billing", "invoice", id] as const,
  summary: (params: { period?: SummaryPeriod; from?: DateKey; to?: DateKey }) =>
    ["admin", "billing", "summary", params] as const,
};

/** 4xx não muda tentando de novo (403 sem FINANCE, 404 rota fora do ar ou fatura). */
function retryUnlessClientError(failureCount: number, error: unknown): boolean {
  const status = apiErrorOf(error).status;
  if (status !== null && status >= 400 && status < 500) return false;
  return failureCount < 2;
}

export function useAdminInvoices(params: AdminInvoiceListParams) {
  return useQuery({
    queryKey: billingKeys.list(params),
    queryFn: () => listAdminInvoices(params),
    placeholderData: keepPreviousData,
    staleTime: 15000,
    retry: retryUnlessClientError,
  });
}

export function useAdminInvoice(id: string) {
  return useQuery({
    queryKey: billingKeys.detail(id),
    queryFn: () => getAdminInvoice(id),
    enabled: !!id,
    staleTime: 15000,
    retry: retryUnlessClientError,
  });
}

export function useBillingSummary(
  params: { period?: SummaryPeriod; from?: DateKey; to?: DateKey } = {},
) {
  return useQuery({
    queryKey: billingKeys.summary(params),
    queryFn: () => getBillingSummary(params),
    placeholderData: keepPreviousData,
    staleTime: 15000,
    retry: retryUnlessClientError,
  });
}

/**
 * Depois de qualquer ação: a lista, o detalhe e os indicadores (prefixo
 * `admin/billing`), o resumo do Financeiro (baixa manual vira entrada) e a
 * lista de Empresas (o selo "bloqueada").
 */
function invalidateAfterAction(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: billingKeys.all }),
    qc.invalidateQueries({ queryKey: ["admin", "finance"] }),
    qc.invalidateQueries({ queryKey: ["admin", "contractors"] }),
  ]);
}

export function useResendInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string; channels?: ResendChannel[] }) => resendInvoice(id, input),
    onSuccess: () => invalidateAfterAction(qc),
  });
}

export function useIssueSecondCopy(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string }) => issueSecondCopy(id, input),
    onSuccess: () => invalidateAfterAction(qc),
  });
}

export function useMarkInvoicePaid(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string; paidAt?: DateKey; amountInCents?: number }) =>
      markInvoicePaid(id, input),
    onSuccess: () => invalidateAfterAction(qc),
  });
}

export function useWaiveInvoiceBlock(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string; until: DateKey }) => waiveInvoiceBlock(id, input),
    onSuccess: () => invalidateAfterAction(qc),
  });
}

export function useBillingAdjustment(contractorUserId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdjustmentInput) => createBillingAdjustment(contractorUserId, input),
    onSuccess: () => invalidateAfterAction(qc),
  });
}

export function useCloseInvoiceNow(contractorUserId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string }) => closeInvoiceNow(contractorUserId, input),
    onSuccess: () => invalidateAfterAction(qc),
  });
}

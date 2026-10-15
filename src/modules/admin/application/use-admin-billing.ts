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
  getBillingCompanies,
  getBillingSummary,
  issueSecondCopy,
  listAdminInvoices,
  markInvoicePaid,
  reissueInvoiceNfse,
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
  companies: ["admin", "billing", "companies"] as const,
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
 * Aba "Empresas faturadas". Sob o prefixo `admin/billing`: toda ação de fatura
 * e a troca do modo de cobrança a recarregam. Recarrega sozinha a cada minuto
 * (o painel não recarrega ao voltar para a aba do navegador).
 */
export function useBillingCompanies() {
  return useQuery({
    queryKey: billingKeys.companies,
    queryFn: getBillingCompanies,
    staleTime: 15000,
    refetchInterval: 60000,
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

/**
 * Erros que dizem que a tela está velha (a fatura já foi paga ou cancelada, a
 * chave foi desligada, não havia nada a faturar; na reemissão da nota: a nota
 * já não está recusada, outra reemissão está em andamento, a fatura não está
 * paga, a nota sumiu ou a emissão está desligada): recarrega tudo, para o
 * detalhe não seguir com as ações ligadas.
 */
const STALE_CODES = new Set([
  "INVOICE_NOT_OPEN",
  "FEATURE_DISABLED",
  "NOTHING_TO_INVOICE",
  "INVOICE_NOT_PAID",
  "NFSE_NOT_FOUND",
  "NFSE_NOT_FAILED",
  "NFSE_REISSUE_IN_PROGRESS",
  "NFSE_DISABLED",
]);

function refreshIfStale(qc: QueryClient, error: unknown) {
  const code = apiErrorOf(error).code;
  if (code && STALE_CODES.has(code)) return invalidateAfterAction(qc);
}

export function useResendInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string; channels?: ResendChannel[] }) => resendInvoice(id, input),
    onSuccess: () => invalidateAfterAction(qc),
    onError: (error) => refreshIfStale(qc, error),
  });
}

export function useIssueSecondCopy(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string }) => issueSecondCopy(id, input),
    onSuccess: () => invalidateAfterAction(qc),
    onError: (error) => refreshIfStale(qc, error),
  });
}

export function useMarkInvoicePaid(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string; paidAt?: DateKey; amountInCents?: number }) =>
      markInvoicePaid(id, input),
    onSuccess: () => invalidateAfterAction(qc),
    onError: (error) => refreshIfStale(qc, error),
  });
}

export function useWaiveInvoiceBlock(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string; until: DateKey }) => waiveInvoiceBlock(id, input),
    onSuccess: () => invalidateAfterAction(qc),
    onError: (error) => refreshIfStale(qc, error),
  });
}

export function useBillingAdjustment(contractorUserId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdjustmentInput) => createBillingAdjustment(contractorUserId, input),
    onSuccess: () => invalidateAfterAction(qc),
    onError: (error) => refreshIfStale(qc, error),
  });
}

export function useCloseInvoiceNow(contractorUserId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string }) => closeInvoiceNow(contractorUserId, input),
    onSuccess: () => invalidateAfterAction(qc),
    onError: (error) => refreshIfStale(qc, error),
  });
}

/** "Reemitir nota": a NFS-e recusada da fatura vai de novo para a prefeitura. */
export function useReissueInvoiceNfse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string }) => reissueInvoiceNfse(id, input),
    onSuccess: () => invalidateAfterAction(qc),
    onError: (error) => refreshIfStale(qc, error),
  });
}

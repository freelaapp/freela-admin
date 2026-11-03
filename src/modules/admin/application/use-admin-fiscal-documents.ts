import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorOf } from "../infrastructure/api-error";
import { reissueInvoiceNfse } from "../infrastructure/billing-api";
import {
  listAdminFiscalDocuments,
  type FiscalDocumentItem,
  type FiscalDocumentListParams,
} from "../infrastructure/fiscal-documents-api";
import { reissueVacancyNfse, type NfseReissueResult } from "../infrastructure/vacancy-documents-api";

export const fiscalDocumentKeys = {
  all: ["admin", "fiscal-documents"] as const,
  list: (params: FiscalDocumentListParams) => ["admin", "fiscal-documents", params] as const,
};

/** 4xx não muda tentando de novo (403 sem FINANCE, 404 rota ainda fora do ar). */
function retryUnlessClientError(failureCount: number, error: unknown): boolean {
  const status = apiErrorOf(error).status;
  if (status !== null && status >= 400 && status < 500) return false;
  return failureCount < 2;
}

export function useAdminFiscalDocuments(params: FiscalDocumentListParams) {
  return useQuery({
    queryKey: fiscalDocumentKeys.list(params),
    queryFn: () => listAdminFiscalDocuments(params),
    placeholderData: keepPreviousData,
    staleTime: 15000,
    refetchInterval: 60000,
    retry: retryUnlessClientError,
  });
}

/**
 * "Reemitir nota" da lista: a rota de cada nota (a da fatura pede o motivo; a da
 * vaga, não). A mensalidade não tem reemissão pelo painel.
 */
export function useReissueFiscalDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      doc,
      reason,
    }: {
      doc: FiscalDocumentItem;
      reason: string;
    }): Promise<NfseReissueResult> => {
      if (doc.reissue.via === "INVOICE" && doc.subject.invoiceId) {
        const res = await reissueInvoiceNfse(doc.subject.invoiceId, { reason });
        return { status: res.status ?? "PENDING", number: res.number, failureReason: res.failureReason };
      }
      if (doc.reissue.via === "VACANCY" && doc.subject.vacancyId) {
        return reissueVacancyNfse(doc.subject.vacancyId);
      }
      throw new Error("Esta nota não tem reemissão pelo painel.");
    },
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: fiscalDocumentKeys.all }),
        qc.invalidateQueries({ queryKey: ["admin", "billing"] }),
        qc.invalidateQueries({ queryKey: ["admin", "vacancies"] }),
      ]),
  });
}

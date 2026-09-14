"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dismissJobIssueReport,
  earlyFinalizePartial,
  getAdminIssueReports,
  previewEarlyFinalizePartial,
  type EarlyFinalizePartialInput,
  type JobIssueStatus,
} from "../infrastructure/issue-reports-api";

const KEY = ["admin", "issue-reports"] as const;

/**
 * Fila de relatos de problema (F6) para o suporte triar. Repolla devagar (90s):
 * é fila de suporte, não precisa de tempo real, e a tela de vagas já repolla no
 * modo painel.
 */
export function useIssueReports(status?: JobIssueStatus) {
  return useQuery({
    queryKey: [...KEY, status ?? "all"],
    queryFn: () => getAdminIssueReports(status),
    staleTime: 30_000,
    refetchInterval: 90_000,
  });
}

/** Atalho para os relatos ainda abertos — o que a fila e o indicador consomem. */
export function useOpenIssueReports() {
  return useIssueReports("OPEN");
}

function invalidateReportsAndVacancies(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
  qc.invalidateQueries({ queryKey: ["admin", "vacancies"] });
  qc.invalidateQueries({ queryKey: ["admin", "casa-vacancies"] });
}

export function useDismissIssueReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => dismissJobIssueReport(id, note),
    onSuccess: () => invalidateReportsAndVacancies(qc),
  });
}

/** Prévia do encerramento parcial (não grava). Sem invalidação — não muda nada. */
export function usePreviewEarlyFinalizePartial() {
  return useMutation({
    mutationFn: ({
      vacancyId,
      input,
    }: {
      vacancyId: string;
      input: EarlyFinalizePartialInput;
    }) => previewEarlyFinalizePartial(vacancyId, input),
  });
}

export function useEarlyFinalizePartial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      vacancyId,
      input,
    }: {
      vacancyId: string;
      input: EarlyFinalizePartialInput;
    }) => earlyFinalizePartial(vacancyId, input),
    onSuccess: () => invalidateReportsAndVacancies(qc),
  });
}

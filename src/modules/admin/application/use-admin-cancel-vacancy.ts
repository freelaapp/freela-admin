"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { adminCancelVacancy, adminRestartVacancy } from "../infrastructure/admin-api";

function invalidateVacancies(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["admin", "vacancies"] });
  qc.invalidateQueries({ queryKey: ["admin", "vacancy-candidacies"] });
}

export function useAdminCancelVacancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vacancyId, reason }: { vacancyId: string; reason: string }) =>
      adminCancelVacancy(vacancyId, reason),
    onSuccess: () => invalidateVacancies(qc),
  });
}

/** Reabre a vaga do zero (no-show) mantendo o valor pago. */
export function useAdminRestartVacancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vacancyId, reason }: { vacancyId: string; reason: string }) =>
      adminRestartVacancy(vacancyId, reason),
    onSuccess: () => invalidateVacancies(qc),
  });
}

export function getAxiosErrorMessage(err: unknown, fallback = "Erro ao cancelar vaga"): string {
  if (axios.isAxiosError(err)) {
    const apiMsg = err.response?.data?.error?.message ?? err.response?.data?.message;
    if (typeof apiMsg === "string") return apiMsg;
    if (Array.isArray(apiMsg) && apiMsg.length > 0) return String(apiMsg[0]);
  }
  return fallback;
}

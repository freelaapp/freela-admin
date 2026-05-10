"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { adminCancelVacancy } from "../infrastructure/admin-api";

export function useAdminCancelVacancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vacancyId, reason }: { vacancyId: string; reason: string }) =>
      adminCancelVacancy(vacancyId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "vacancies"] });
      qc.invalidateQueries({ queryKey: ["admin", "vacancy-candidacies"] });
    },
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

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminCancelCasaVacancy } from "../infrastructure/casa-vacancies-api";
import type { RefundType } from "../infrastructure/admin-api";

/**
 * Cancela uma vaga do Freela em Casa com escolha explícita de estorno.
 * Invalida a mesma query key usada por `vagas-casa/page.tsx`.
 */
export function useAdminCancelCasaVacancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      vacancyId,
      reason,
      refundType,
    }: {
      vacancyId: string;
      reason: string;
      refundType?: RefundType;
    }) => adminCancelCasaVacancy(vacancyId, reason, refundType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "casa-vacancies"] });
    },
  });
}

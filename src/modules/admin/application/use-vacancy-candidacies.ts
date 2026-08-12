"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminConfirmCandidacy, getVacancyCandidacies } from "../infrastructure/admin-api";

export function useVacancyCandidacies(vacancyId: string | null) {
  return useQuery({
    queryKey: ["admin", "vacancy-candidacies", vacancyId],
    queryFn: () => getVacancyCandidacies(vacancyId as string),
    enabled: !!vacancyId,
    staleTime: 30000,
  });
}

/**
 * Confirma a presença do freelancer pelo painel.
 *
 * Invalida a lista da PRÓPRIA vaga: sem isso o cartão continuaria mostrando
 * "aguardando confirmação" depois de confirmar, e o operador clicaria de novo.
 */
export function useConfirmCandidacy(vacancyId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidacyId: string) => adminConfirmCandidacy(candidacyId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "vacancy-candidacies", vacancyId],
      });
    },
  });
}

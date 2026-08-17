"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminConfirmCandidacy,
  adminReinstateCandidacy,
  getVacancyCandidacies,
} from "../infrastructure/admin-api";

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

/**
 * Recoloca na vaga quem foi desalocado por não confirmar no link.
 *
 * Invalida a lista de vagas junto com a da própria vaga: a operação FECHA a
 * vaga de volta, então a tabela atrás do modal fica errada se não recarregar.
 */
export function useReinstateCandidacy(vacancyId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidacyId: string) => adminReinstateCandidacy(candidacyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "vacancy-candidacies", vacancyId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "vacancies"] });
    },
  });
}

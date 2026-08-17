"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminConfirmCasaCandidacy,
  adminRemoveCasaCandidacy,
  adminRestartCasaVacancy,
  getCasaVacancyCandidacies,
  getCasaVacancyFeedbacks,
} from "../infrastructure/casa-vacancies-api";

/**
 * Ações da vaga do Freela em Casa — as mesmas de Empresa, na base
 * `/v1/home-services/admin`.
 *
 * As rotas já existiam no backend desde antes desta tela; o painel do Casa é que
 * não as chamava. As chaves de cache espelham as de Empresa com o prefixo
 * `casa-`, para as duas telas nunca invalidarem a lista uma da outra.
 */

export function useCasaVacancyCandidacies(vacancyId: string | null) {
  return useQuery({
    queryKey: ["admin", "casa-vacancy-candidacies", vacancyId],
    queryFn: () => getCasaVacancyCandidacies(vacancyId as string),
    enabled: !!vacancyId,
    staleTime: 30000,
  });
}

export function useCasaVacancyFeedbacks(vacancyId: string | null) {
  return useQuery({
    queryKey: ["admin", "casa-vacancy-feedbacks", vacancyId],
    queryFn: () => getCasaVacancyFeedbacks(vacancyId as string),
    enabled: !!vacancyId,
    staleTime: 30000,
  });
}

/**
 * Confirma a presença pelo painel. Invalida a lista da PRÓPRIA vaga: sem isso o
 * cartão seguiria dizendo "aguardando confirmação" e o operador clicaria de novo.
 */
export function useConfirmCasaCandidacy(vacancyId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (candidacyId: string) => adminConfirmCasaCandidacy(candidacyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "casa-vacancy-candidacies", vacancyId] });
    },
  });
}

export function useAdminRestartCasaVacancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vacancyId, reason }: { vacancyId: string; reason: string }) =>
      adminRestartCasaVacancy(vacancyId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "casa-vacancies"] });
      qc.invalidateQueries({ queryKey: ["admin", "casa-vacancy-candidacies"] });
    },
  });
}

export function useAdminRemoveCasaCandidacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      vacancyId,
      candidacyId,
      reason,
    }: {
      vacancyId: string;
      candidacyId: string;
      reason?: string;
    }) => adminRemoveCasaCandidacy(vacancyId, candidacyId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "casa-vacancies"] });
      qc.invalidateQueries({ queryKey: ["admin", "casa-vacancy-candidacies"] });
    },
  });
}

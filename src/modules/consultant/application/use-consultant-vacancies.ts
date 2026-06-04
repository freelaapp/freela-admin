"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listConsultantVacanciesApi,
  listConsultantVacancyCandidaciesApi,
} from "@/modules/consultant/infrastructure/consultant-api";

/** Vagas (abertas + fechadas, BR + Casa) dos contratantes indicados pelo consultor. */
export function useConsultantVacancies() {
  return useQuery({
    queryKey: ["consultant", "vacancies"],
    queryFn: listConsultantVacanciesApi,
    staleTime: 15000,
  });
}

/** Candidaturas de uma vaga (BR). Habilitada apenas quando há um `vacancyId`. */
export function useConsultantVacancyCandidacies(vacancyId: string | null) {
  return useQuery({
    queryKey: ["consultant", "vacancy-candidacies", vacancyId],
    queryFn: () => listConsultantVacancyCandidaciesApi(vacancyId as string),
    enabled: !!vacancyId,
    staleTime: 15000,
  });
}

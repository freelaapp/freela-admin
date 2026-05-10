"use client";

import { useQuery } from "@tanstack/react-query";
import { getVacancyCandidacies } from "../infrastructure/admin-api";

export function useVacancyCandidacies(vacancyId: string | null) {
  return useQuery({
    queryKey: ["admin", "vacancy-candidacies", vacancyId],
    queryFn: () => getVacancyCandidacies(vacancyId as string),
    enabled: !!vacancyId,
    staleTime: 30000,
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { getVacancyFeedbacks } from "../infrastructure/admin-api";

export function useVacancyFeedbacks(vacancyId: string | null) {
  return useQuery({
    queryKey: ["admin", "vacancy-feedbacks", vacancyId],
    queryFn: () => getVacancyFeedbacks(vacancyId as string),
    enabled: !!vacancyId,
    staleTime: 30000,
  });
}

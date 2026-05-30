"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminCasaAllVacancies } from "../infrastructure/casa-vacancies-api";

export function useAdminCasaVacancies(consultantId?: string) {
  return useQuery({
    queryKey: ["admin", "casa-vacancies", consultantId ?? null],
    queryFn: () => getAdminCasaAllVacancies(consultantId),
    staleTime: 30000,
  });
}

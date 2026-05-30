"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminAllVacancies } from "../infrastructure/admin-api";

export function useAdminVacancies(consultantId?: string) {
  return useQuery({
    queryKey: ["admin", "vacancies", consultantId ?? null],
    queryFn: () => getAdminAllVacancies(consultantId),
    staleTime: 30000,
  });
}

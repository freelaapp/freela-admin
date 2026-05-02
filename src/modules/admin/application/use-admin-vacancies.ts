"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminAllVacancies } from "../infrastructure/admin-api";

export function useAdminVacancies() {
  return useQuery({
    queryKey: ["admin", "vacancies"],
    queryFn: getAdminAllVacancies,
    staleTime: 30000,
  });
}

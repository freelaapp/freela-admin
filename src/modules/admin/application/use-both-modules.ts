"use client";

import { useQuery } from "@tanstack/react-query";
import { getAllContractors, getAllProviders } from "../infrastructure/both-modules-api";

/** Contratantes dos dois módulos (Empresa + Casa). */
export function useAllContractors() {
  return useQuery({
    queryKey: ["admin", "all-contractors"],
    queryFn: getAllContractors,
    staleTime: 30000,
  });
}

/** Prestadores dos dois módulos (Empresa + Casa), paginação agregada. */
export function useAllProviders() {
  return useQuery({
    queryKey: ["admin", "all-providers"],
    queryFn: getAllProviders,
    staleTime: 60000,
  });
}

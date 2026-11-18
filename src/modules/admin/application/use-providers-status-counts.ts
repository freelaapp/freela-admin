"use client";

import { useQuery } from "@tanstack/react-query";
import { getProvidersStatusCounts } from "../infrastructure/admin-api";

/**
 * D5, fatia B: os contadores da página Freelancers. A API antiga não tem a rota (404): sem
 * insistir, e a página esconde a faixa e os filtros novos.
 */
export function useProvidersStatusCounts(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "providers", "status-counts"],
    queryFn: getProvidersStatusCounts,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

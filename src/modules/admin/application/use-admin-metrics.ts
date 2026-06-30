"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getAdminMetrics, type AdminMetricsParams } from "../infrastructure/admin-api";

export function useAdminMetrics(params?: AdminMetricsParams) {
  const city = params?.city || undefined;
  const role = params?.role || undefined;
  return useQuery({
    queryKey: ["admin", "metrics", { city, role }],
    queryFn: () => getAdminMetrics({ city, role }),
    // Mantém os números anteriores enquanto refaz com o novo filtro (sem flash do spinner).
    placeholderData: keepPreviousData,
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

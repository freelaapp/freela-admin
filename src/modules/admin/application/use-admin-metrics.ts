"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminMetrics } from "../infrastructure/admin-api";

export function useAdminMetrics() {
  return useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: getAdminMetrics,
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

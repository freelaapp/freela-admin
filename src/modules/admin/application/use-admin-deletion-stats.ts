"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminDeletionStats } from "../infrastructure/admin-api";

export function useAdminDeletionStats() {
  return useQuery({
    queryKey: ["admin", "deletion-stats"],
    queryFn: getAdminDeletionStats,
    staleTime: 30000,
  });
}

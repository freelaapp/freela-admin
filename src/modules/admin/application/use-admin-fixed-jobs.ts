"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminFixedJobs } from "../infrastructure/fixed-jobs-api";

export function useAdminFixedJobs(consultantId?: string) {
  return useQuery({
    queryKey: ["admin", "fixed-jobs", consultantId ?? null],
    queryFn: () => getAdminFixedJobs(consultantId),
    staleTime: 30000,
  });
}

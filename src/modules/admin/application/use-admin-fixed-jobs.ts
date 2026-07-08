"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminFixedJob,
  getAdminFixedJobs,
  type CreateAdminFixedJobPayload,
} from "../infrastructure/fixed-jobs-api";

export function useAdminFixedJobs(consultantId?: string) {
  return useQuery({
    queryKey: ["admin", "fixed-jobs", consultantId ?? null],
    queryFn: () => getAdminFixedJobs(consultantId),
    staleTime: 30000,
  });
}

/** Cria uma vaga fixa/CLT em nome de um contratante e revalida a listagem admin. */
export function useCreateAdminFixedJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAdminFixedJobPayload) => createAdminFixedJob(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "fixed-jobs"] });
    },
  });
}

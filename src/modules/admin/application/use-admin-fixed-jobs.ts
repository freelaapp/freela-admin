"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminFixedJob,
  getAdminFixedJobs,
  getFixedJobApplications,
  setFixedJobApplicationStatus,
  type CreateAdminFixedJobPayload,
  type FixedJobApplicationStatus,
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

/** Candidaturas de uma vaga fixa (viewer de candidatos). */
export function useFixedJobApplications(postId: string | null | undefined) {
  return useQuery({
    queryKey: ["admin", "fixed-jobs", postId, "applications"],
    queryFn: () => getFixedJobApplications(postId as string),
    enabled: Boolean(postId),
    staleTime: 15000,
  });
}

/**
 * Muda o status de uma candidatura (ACTIVE ⇄ REJECTED) e revalida a lista de
 * candidatos da vaga. `postId` mira a invalidação na key exata
 * `["admin","fixed-jobs",postId,"applications"]`; a invalidação do prefixo
 * `["admin","fixed-jobs"]` também atualiza a contagem de candidatos na listagem.
 */
export function useSetFixedJobApplicationStatus(postId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { applicationId: string; status: FixedJobApplicationStatus }) =>
      setFixedJobApplicationStatus(vars.applicationId, vars.status),
    onSuccess: () => {
      if (postId) {
        qc.invalidateQueries({ queryKey: ["admin", "fixed-jobs", postId, "applications"] });
      }
      qc.invalidateQueries({ queryKey: ["admin", "fixed-jobs"] });
    },
  });
}

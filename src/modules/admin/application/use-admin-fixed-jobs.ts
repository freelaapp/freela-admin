"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFixedJobReach,
  resendFixedJobGroupMessage,
  createAdminFixedJob,
  getAdminFixedJobs,
  getFixedJobApplications,
  getFixedJobKanban,
  runFixedJobMatchScore,
  setFixedJobApplicationStage,
  setFixedJobApplicationStatus,
  type CreateAdminFixedJobPayload,
  type FixedJobApplicationStatus,
  type FixedJobKanbanStage,
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
        qc.invalidateQueries({ queryKey: ["admin", "fixed-jobs", postId, "kanban"] });
      }
      qc.invalidateQueries({ queryKey: ["admin", "fixed-jobs"] });
    },
  });
}

/** Board do kanban de seleção da vaga fixa (6 colunas, cards com score de compatibilidade determinístico). */
export function useFixedJobKanban(postId: string | null | undefined) {
  return useQuery({
    queryKey: ["admin", "fixed-jobs", postId, "kanban"],
    queryFn: () => getFixedJobKanban(postId as string),
    enabled: Boolean(postId),
    staleTime: 15000,
  });
}

/** Move um card de coluna e revalida o board (e a lista de candidatos, que mostra o mesmo dado). */
export function useMoveFixedJobApplication(postId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { applicationId: string; stage: FixedJobKanbanStage }) =>
      setFixedJobApplicationStage(vars.applicationId, vars.stage),
    onSuccess: () => {
      if (postId) {
        qc.invalidateQueries({ queryKey: ["admin", "fixed-jobs", postId, "kanban"] });
        qc.invalidateQueries({ queryKey: ["admin", "fixed-jobs", postId, "applications"] });
      }
    },
  });
}

/** Calcula a compatibilidade determinística da vaga e revalida o board (os promovidos mudam de coluna). */
export function useRunFixedJobMatchScore(postId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { postId: string; force?: boolean }) =>
      runFixedJobMatchScore(vars.postId, vars.force ?? false),
    onSuccess: () => {
      if (postId) {
        qc.invalidateQueries({ queryKey: ["admin", "fixed-jobs", postId, "kanban"] });
        qc.invalidateQueries({ queryKey: ["admin", "fixed-jobs", postId, "applications"] });
      }
    },
  });
}

/**
 * Alcance da vaga fixa. `staleTime` curto de propósito: o número muda quando o
 * geocode roda e quando alguém se cadastra na cidade, e é consultado justamente
 * para decidir se vale reanunciar.
 */
export function useFixedJobReach(postId: string | null) {
  return useQuery({
    queryKey: ["admin", "fixed-job-reach", postId],
    queryFn: () => getFixedJobReach(postId as string),
    enabled: !!postId,
    staleTime: 10_000,
  });
}

/** Reanuncia a vaga no grupo da cidade. Invalida o alcance: o envio revalida o roteamento. */
export function useResendFixedJobGroupMessage(postId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resendFixedJobGroupMessage(postId as string),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "fixed-job-reach", postId] });
    },
  });
}

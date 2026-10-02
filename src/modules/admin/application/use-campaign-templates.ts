"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCampaignTemplate,
  getCampaignTemplate,
  listCampaignTemplateRuns,
  listCampaignTemplates,
  setCampaignTemplateEnabled,
  updateCampaignTemplate,
  type UpsertCampaignTemplatePayload,
} from "../infrastructure/campaign-templates-api";

const CAMPAIGN_TEMPLATES_KEY = ["admin", "campaign-templates"] as const;

export function useCampaignTemplates() {
  return useQuery({
    queryKey: CAMPAIGN_TEMPLATES_KEY,
    queryFn: listCampaignTemplates,
  });
}

export function useCampaignTemplate(id: string | null) {
  return useQuery({
    queryKey: [...CAMPAIGN_TEMPLATES_KEY, id],
    queryFn: () => getCampaignTemplate(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateCampaignTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertCampaignTemplatePayload) => createCampaignTemplate(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGN_TEMPLATES_KEY }),
  });
}

export function useUpdateCampaignTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpsertCampaignTemplatePayload }) =>
      updateCampaignTemplate(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGN_TEMPLATES_KEY }),
  });
}

export function useSetCampaignTemplateEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setCampaignTemplateEnabled(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGN_TEMPLATES_KEY }),
  });
}

/** Execuções por página no histórico da automática (a API aceita até 50). */
export const RUNS_PAGE_SIZE = 20;

/** Histórico das execuções de uma automática (spec 2026-10-01 parte 2 §7). */
export function useCampaignTemplateRuns(id: string | null, page: number) {
  return useQuery({
    queryKey: [...CAMPAIGN_TEMPLATES_KEY, id, "runs", page],
    queryFn: () => listCampaignTemplateRuns(id as string, { page, pageSize: RUNS_PAGE_SIZE }),
    enabled: Boolean(id),
    // Mantém a página anterior só ao paginar a MESMA automática; outra automática carrega do zero.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[CAMPAIGN_TEMPLATES_KEY.length] === id ? previous : undefined,
  });
}

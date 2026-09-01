"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCampaignTemplate,
  getCampaignTemplate,
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

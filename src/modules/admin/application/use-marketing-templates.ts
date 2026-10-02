"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveMarketingTemplate,
  createMarketingTemplate,
  listMarketingTemplates,
  newMarketingTemplateVersion,
  sendMarketingTemplateTest,
  submitMarketingTemplate,
  updateMarketingTemplate,
  type MarketingTemplateInput,
  type MarketingTemplateStatus,
} from "../infrastructure/marketing-templates-api";

export const MARKETING_TEMPLATES_KEY = ["admin", "marketing-templates"] as const;

/** Biblioteca (sem filtro = tudo menos arquivado). */
export function useMarketingTemplates(status?: MarketingTemplateStatus) {
  return useQuery({
    queryKey: [...MARKETING_TEMPLATES_KEY, status ?? "all"],
    queryFn: () => listMarketingTemplates(status),
    staleTime: 15_000,
    // "Em análise" vira "Aprovado" sozinho (webhook ou conferência de 10 min na API):
    // a lista aberta acompanha sem F5.
    refetchInterval: 60_000,
  });
}

/** Toda escrita invalida a biblioteca inteira: lista, uso e situação mudam juntos. */
function useLibraryMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: MARKETING_TEMPLATES_KEY }),
  });
}

export function useCreateMarketingTemplate() {
  return useLibraryMutation((input: MarketingTemplateInput) => createMarketingTemplate(input));
}

export function useUpdateMarketingTemplate() {
  return useLibraryMutation(({ id, input }: { id: string; input: MarketingTemplateInput }) =>
    updateMarketingTemplate(id, input),
  );
}

export function useNewMarketingTemplateVersion() {
  return useLibraryMutation((id: string) => newMarketingTemplateVersion(id));
}

export function useArchiveMarketingTemplate() {
  return useLibraryMutation((id: string) => archiveMarketingTemplate(id));
}

export function useSubmitMarketingTemplate() {
  return useLibraryMutation((id: string) => submitMarketingTemplate(id));
}

/** "Enviar teste para mim": não muda a biblioteca, então não invalida nada. */
export function useSendMarketingTemplateTest() {
  return useMutation({
    mutationFn: ({ id, campaignId, phone }: { id: string; campaignId?: string; phone?: string }) =>
      sendMarketingTemplateTest(id, {
        ...(campaignId ? { campaignId } : {}),
        ...(phone ? { phone } : {}),
      }),
  });
}

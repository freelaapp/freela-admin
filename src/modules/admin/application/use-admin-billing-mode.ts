"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorOf } from "../infrastructure/api-error";
import {
  getBillingModeSettings,
  updateBillingMode,
  type UpdateBillingModeInput,
} from "../infrastructure/billing-mode-api";
import { contractorSettingsKeys } from "./use-admin-contractor-settings";

export const billingModeKeys = {
  settings: (contractorUserId: string) => ["admin", "billing-mode", contractorUserId] as const,
};

/** 4xx não muda tentando de novo (403 sem FINANCE, 404 empresa não existe). */
function retryUnlessClientError(failureCount: number, error: unknown): boolean {
  const status = apiErrorOf(error).status;
  if (status !== null && status >= 400 && status < 500) return false;
  return failureCount < 2;
}

/**
 * Modo de cobrança da empresa (GET do admin, FINANCE). Sem cache longo: o
 * "Corrigir cadastro" muda os pré-requisitos, e a aba precisa ler de novo.
 */
export function useAdminBillingMode(contractorUserId: string, enabled = true) {
  return useQuery({
    queryKey: billingModeKeys.settings(contractorUserId),
    queryFn: () => getBillingModeSettings(contractorUserId),
    enabled: enabled && !!contractorUserId,
    staleTime: 0,
    retry: retryUnlessClientError,
  });
}

/**
 * Muda o modo e/ou o e-mail do financeiro, com motivo. A resposta do PATCH já
 * é o estado novo e vai direto para o cache. Recarrega também as preferências
 * (que trazem o modo), o histórico (linha nova no topo) e a lista de Empresas
 * (o selo "Faturado semanal" ao lado do nome).
 */
export function useUpdateAdminBillingMode(contractorUserId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBillingModeInput) => updateBillingMode(contractorUserId, input),
    onSuccess: (view) => {
      qc.setQueryData(billingModeKeys.settings(contractorUserId), view);
      return Promise.all([
        qc.invalidateQueries({ queryKey: billingModeKeys.settings(contractorUserId) }),
        qc.invalidateQueries({ queryKey: contractorSettingsKeys.settings(contractorUserId) }),
        qc.invalidateQueries({ queryKey: contractorSettingsKeys.history(contractorUserId) }),
        qc.invalidateQueries({ queryKey: ["admin", "contractors"] }),
      ]);
    },
  });
}

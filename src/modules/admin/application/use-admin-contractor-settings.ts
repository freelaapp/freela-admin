"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getContractorSettings,
  getContractorSettingsHistory,
  updateContractorSettings,
  type UpdateContractorSettingsInput,
} from "../infrastructure/contractor-settings-api";

export const contractorSettingsKeys = {
  settings: (contractorUserId: string) =>
    ["admin", "contractor-settings", contractorUserId] as const,
  history: (contractorUserId: string) =>
    ["admin", "contractor-settings-history", contractorUserId] as const,
};

/** Burocracias da empresa (GET do admin). */
export function useAdminContractorSettings(contractorUserId: string, enabled = true) {
  return useQuery({
    queryKey: contractorSettingsKeys.settings(contractorUserId),
    queryFn: () => getContractorSettings(contractorUserId),
    enabled: enabled && !!contractorUserId,
    staleTime: 30000,
  });
}

/** Trilha de mudanças (quem, quando, de onde, de → para, motivo). */
export function useAdminContractorSettingsHistory(contractorUserId: string, enabled = true) {
  return useQuery({
    queryKey: contractorSettingsKeys.history(contractorUserId),
    queryFn: () => getContractorSettingsHistory(contractorUserId),
    enabled: enabled && !!contractorUserId,
    staleTime: 30000,
  });
}

/**
 * Salva as burocracias com motivo. A resposta do PATCH já é o estado novo e vai
 * direto para o cache; o histórico é recarregado para ganhar a linha no topo.
 */
export function useUpdateAdminContractorSettings(contractorUserId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateContractorSettingsInput) =>
      updateContractorSettings(contractorUserId, input),
    onSuccess: (view) => {
      qc.setQueryData(contractorSettingsKeys.settings(contractorUserId), view);
      return Promise.all([
        qc.invalidateQueries({ queryKey: contractorSettingsKeys.settings(contractorUserId) }),
        qc.invalidateQueries({ queryKey: contractorSettingsKeys.history(contractorUserId) }),
      ]);
    },
  });
}

"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminProviders,
  getProvidersFilterOptions,
  adminHardDeleteUser,
  adminSetFreelancerBanned,
  clearProviderLowPriority,
  type GetAdminProvidersParams,
} from "../infrastructure/admin-api";
import { getAxiosErrorMessage } from "./use-admin-cancel-vacancy";

export function useAdminProviders(params: GetAdminProvidersParams) {
  return useQuery({
    queryKey: ["admin", "providers", params],
    queryFn: () => getAdminProviders(params),
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });
}

export function useProvidersFilterOptions() {
  return useQuery({
    queryKey: ["admin", "providers", "filter-options"],
    queryFn: getProvidersFilterOptions,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminHardDeleteProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminHardDeleteUser(userId, reason, "freelancer"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "providers"] });
    },
  });
}

/** Banir (definitivo) / desbanir um freelancer — bloqueia/libera o login. */
export function useAdminBanFreelancer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, banned }: { userId: string; banned: boolean }) =>
      adminSetFreelancerBanned(userId, banned),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "providers"] });
    },
  });
}

/** Restaura a prioridade normal de um freelancer na lista de baixa prioridade. */
export function useClearLowPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId }: { userId: string }) => clearProviderLowPriority(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "providers"] });
      toast.success("Prioridade normal restaurada.");
    },
    onError: (err) => {
      toast.error(getAxiosErrorMessage(err, "Não foi possível restaurar a prioridade."));
    },
  });
}

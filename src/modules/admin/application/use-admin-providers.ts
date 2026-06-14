"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  getAdminProviders,
  getProvidersFilterOptions,
  adminHardDeleteUser,
  type GetAdminProvidersParams,
} from "../infrastructure/admin-api";

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

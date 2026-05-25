"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  getAdminProviders,
  getProvidersFilterOptions,
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

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getParameterChanges,
  getPlatformParameters,
  updatePlatformParameter,
} from "../infrastructure/platform-parameters-api";

const KEY = ["admin", "platform-parameters"] as const;

export function usePlatformParameters() {
  return useQuery({ queryKey: KEY, queryFn: getPlatformParameters, staleTime: 30_000 });
}

export function useParameterChanges(key: string, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, key, "changes"],
    queryFn: () => getParameterChanges(key),
    enabled,
  });
}

export function useUpdatePlatformParameter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { key: string; value: number; reason: string; expectedVersion: number }) =>
      updatePlatformParameter(input.key, {
        value: input.value,
        reason: input.reason,
        expectedVersion: input.expectedVersion,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

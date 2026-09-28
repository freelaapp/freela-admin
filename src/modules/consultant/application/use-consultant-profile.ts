"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getConsultantProfileApi,
  updateConsultantProfileApi,
} from "@/modules/consultant/infrastructure/consultant-api";
import type { UpdateConsultantProfilePayload } from "@/modules/consultant/domain/types";

export const CONSULTANT_PROFILE_QUERY_KEY = ["consultant", "me"] as const;

export function useConsultantProfile() {
  return useQuery({
    queryKey: CONSULTANT_PROFILE_QUERY_KEY,
    queryFn: getConsultantProfileApi,
    staleTime: 15000,
  });
}

export function useUpdateConsultantProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateConsultantProfilePayload) => updateConsultantProfileApi(payload),
    onSuccess: (profile) => {
      qc.setQueryData(CONSULTANT_PROFILE_QUERY_KEY, profile);
    },
  });
}

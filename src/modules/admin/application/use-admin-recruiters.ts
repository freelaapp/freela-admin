"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminRecruiter,
  getAdminRecruiters,
  CreateRecruiterPayload,
} from "../infrastructure/admin-api";

export function useAdminRecruiters() {
  return useQuery({
    queryKey: ["admin", "recruiters"],
    queryFn: getAdminRecruiters,
    staleTime: 30000,
  });
}

export function useCreateAdminRecruiter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRecruiterPayload) => createAdminRecruiter(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "recruiters"] });
    },
  });
}

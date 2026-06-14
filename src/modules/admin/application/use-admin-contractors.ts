"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminContractors, adminHardDeleteUser } from "../infrastructure/admin-api";

export function useAdminContractors() {
  return useQuery({
    queryKey: ["admin", "contractors"],
    queryFn: getAdminContractors,
    staleTime: 30000,
  });
}

export function useAdminHardDeleteContractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminHardDeleteUser(userId, reason, "contractor"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "contractors"] });
    },
  });
}

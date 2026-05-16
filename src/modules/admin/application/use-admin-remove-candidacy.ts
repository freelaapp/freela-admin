"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminRemoveCandidacy } from "../infrastructure/admin-api";

export function useAdminRemoveCandidacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      vacancyId,
      candidacyId,
      reason,
    }: {
      vacancyId: string;
      candidacyId: string;
      reason?: string;
    }) => adminRemoveCandidacy(vacancyId, candidacyId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "vacancies"] });
      qc.invalidateQueries({ queryKey: ["admin", "vacancy-candidacies"] });
    },
  });
}

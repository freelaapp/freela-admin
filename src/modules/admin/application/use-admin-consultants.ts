"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminConsultant,
  getAdminConsultants,
  updateAdminConsultant,
  type CreateConsultantPayload,
  type UpdateConsultantPayload,
} from "../infrastructure/consultants-api";

export function useAdminConsultants() {
  return useQuery({
    queryKey: ["admin", "consultants"],
    queryFn: getAdminConsultants,
    staleTime: 30000,
  });
}

export function useCreateAdminConsultant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateConsultantPayload) => createAdminConsultant(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "consultants"] });
    },
  });
}

export function useUpdateAdminConsultant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateConsultantPayload }) =>
      updateAdminConsultant(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "consultants"] });
    },
  });
}

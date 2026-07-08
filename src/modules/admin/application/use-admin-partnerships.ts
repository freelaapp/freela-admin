"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminPartnership,
  getAdminPartnerships,
  getAdminPartnershipReport,
  updateAdminPartnership,
  type CreatePartnershipPayload,
  type UpdatePartnershipPayload,
} from "../infrastructure/partnerships-api";

export function useAdminPartnerships() {
  return useQuery({
    queryKey: ["admin", "partnerships"],
    queryFn: getAdminPartnerships,
    staleTime: 30000,
  });
}

export function useCreateAdminPartnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePartnershipPayload) => createAdminPartnership(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "partnerships"] });
    },
  });
}

export function useUpdateAdminPartnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePartnershipPayload }) =>
      updateAdminPartnership(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "partnerships"] });
    },
  });
}

export function useAdminPartnershipReport(id: string | null) {
  return useQuery({
    queryKey: ["admin", "partnerships", id, "report"],
    queryFn: () => getAdminPartnershipReport(id as string),
    enabled: !!id,
    staleTime: 30000,
  });
}

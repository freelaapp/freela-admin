"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDedicatedGroup,
  createDedicatedWhatsappGroup,
  deleteDedicatedGroup,
  getDedicatedGroups,
  updateDedicatedGroup,
} from "../infrastructure/dedicated-groups-api";

const KEY = ["admin", "dedicated-notification-groups"];

export function useDedicatedGroups() {
  return useQuery({
    queryKey: KEY,
    queryFn: getDedicatedGroups,
    staleTime: 30000,
  });
}

export function useCreateDedicatedGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDedicatedGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateDedicatedGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      input: {
        label?: string;
        companyMatch?: string;
        cityMatch?: string | null;
        enabled?: boolean;
      };
    }) => updateDedicatedGroup(vars.id, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteDedicatedGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDedicatedGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreateDedicatedWhatsappGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; participants: string[] }) =>
      createDedicatedWhatsappGroup(vars.id, vars.participants),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

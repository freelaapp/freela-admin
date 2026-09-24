"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addGroupParticipants,
  createWhatsappGroup,
  deleteAdminGroup,
  getAdminGroups,
  getGroupSettings,
  updateGroupSettings,
} from "../infrastructure/whatsapp-groups-api";
import { VIP_GROUP_KEYS } from "./use-vip-groups";

export const ADMIN_GROUPS_KEYS = {
  list: ["admin", "whatsapp-groups", "list"] as const,
  settings: ["admin", "whatsapp-groups", "settings"] as const,
};

export function useAdminGroups() {
  return useQuery({ queryKey: ADMIN_GROUPS_KEYS.list, queryFn: () => getAdminGroups(), staleTime: 30_000 });
}

/** "Atualizar": força o diretório e troca a lista; a lista VIP relê o selo do bot. */
export function useRefreshAdminGroups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getAdminGroups({ refresh: true }),
    onSuccess: (data) => {
      qc.setQueryData(ADMIN_GROUPS_KEYS.list, data);
      qc.invalidateQueries({ queryKey: VIP_GROUP_KEYS.all });
    },
  });
}

export function useDeleteAdminGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_GROUPS_KEYS.list }),
  });
}

export function useGroupSettings() {
  return useQuery({ queryKey: ADMIN_GROUPS_KEYS.settings, queryFn: getGroupSettings, staleTime: 60_000 });
}

export function useUpdateGroupSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateGroupSettings,
    onSuccess: (data) => qc.setQueryData(ADMIN_GROUPS_KEYS.settings, data),
  });
}

export function useCreateWhatsappGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createWhatsappGroup,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_GROUPS_KEYS.list });
    },
  });
}

export function useAddGroupParticipants() {
  return useMutation({ mutationFn: addGroupParticipants });
}

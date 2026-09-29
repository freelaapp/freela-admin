"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPanelUser,
  deletePanelUser,
  getPanelUserPermissions,
  getPanelUsers,
  resetPanelUserAccess,
  restorePanelUser,
  updatePanelUser,
  type CreatePanelUserPayload,
  type UpdatePanelUserPayload,
} from "../infrastructure/panel-users-api";
import { ADMIN_ME_QUERY_KEY } from "@/modules/auth/application/use-auth";

const PANEL_USERS_KEY = ["admin", "panel-users"] as const;

export function useAdminPanelUsers(includeDeleted = false) {
  return useQuery({
    queryKey: [...PANEL_USERS_KEY, { includeDeleted }],
    queryFn: () => getPanelUsers({ includeDeleted }),
    staleTime: 30000,
  });
}

/** Catálogo de áreas do painel (chave + rótulo em PT) servido pela API. */
export function useAdminPanelPermissions() {
  return useQuery({
    queryKey: ["admin", "panel-users", "permissions"],
    queryFn: getPanelUserPermissions,
    // Catálogo é estático: só muda quando a API ganha uma área nova.
    staleTime: 60 * 60 * 1000,
  });
}

export function useCreateAdminPanelUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePanelUserPayload) => createPanelUser(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PANEL_USERS_KEY });
    },
  });
}

export function useUpdateAdminPanelUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePanelUserPayload }) =>
      updatePanelUser(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PANEL_USERS_KEY });
      // O super-admin pode estar editando a si mesmo: a própria sessão
      // (papel/permissões, que gate o menu) precisa ser relida.
      qc.invalidateQueries({ queryKey: ADMIN_ME_QUERY_KEY });
    },
  });
}

export function useResetAdminPanelUserAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activate }: { id: string; activate?: boolean }) =>
      resetPanelUserAccess(id, { activate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PANEL_USERS_KEY });
    },
  });
}

export function useDeleteAdminPanelUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePanelUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PANEL_USERS_KEY });
    },
  });
}

export function useRestoreAdminPanelUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restorePanelUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PANEL_USERS_KEY });
    },
  });
}

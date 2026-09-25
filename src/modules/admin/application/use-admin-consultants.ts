"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminConsultant,
  deleteAdminConsultant,
  getAdminConsultant,
  getAdminConsultants,
  updateAdminConsultant,
  resetConsultantAccess,
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

export function useAdminConsultant(id: string | null | undefined) {
  return useQuery({
    queryKey: ["admin", "consultants", id],
    queryFn: () => getAdminConsultant(id!),
    enabled: !!id,
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

export function useResetConsultantAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resetConsultantAccess(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["admin", "consultants"] });
      qc.invalidateQueries({ queryKey: ["admin", "consultants", id] });
    },
  });
}

export function useDeleteAdminConsultant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAdminConsultant(id),
    onSuccess: () => {
      // Só a lista (`exact`): invalidar o detalhe do consultor apagado faria a tela
      // de perfil — ainda montada até o redirect — refazer o GET e tomar 404.
      qc.invalidateQueries({ queryKey: ["admin", "consultants"], exact: true });
    },
  });
}

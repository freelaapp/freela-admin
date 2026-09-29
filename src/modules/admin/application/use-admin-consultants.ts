"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminConsultant,
  deleteAdminConsultant,
  getAdminConsultant,
  getAdminConsultants,
  updateAdminConsultant,
  resetConsultantAccess,
  restoreAdminConsultant,
  type CreateConsultantPayload,
  type UpdateConsultantPayload,
} from "../infrastructure/consultants-api";

/**
 * Lista de consultores. Padrão: sem os excluídos (é o que os filtros de Jobs,
 * Vagas Casa e Vagas Fixas usam). `includeDeleted` é o "Mostrar excluídos" da
 * tela de consultores.
 */
export function useAdminConsultants(options: { includeDeleted?: boolean } = {}) {
  const includeDeleted = !!options.includeDeleted;
  return useQuery({
    queryKey: includeDeleted
      ? ["admin", "consultants", { includeDeleted: true }]
      : ["admin", "consultants"],
    queryFn: () => getAdminConsultants({ includeDeleted }),
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
      // Listas (com e sem excluídos), sem o detalhe: invalidar o detalhe do
      // consultor APAGADO faria a tela de perfil — ainda montada até o redirect —
      // refazer o GET e tomar 404. Exclusão lógica atualiza o detalhe na tela.
      qc.invalidateQueries({ queryKey: ["admin", "consultants"], exact: true });
      qc.invalidateQueries({ queryKey: ["admin", "consultants", { includeDeleted: true }] });
    },
  });
}

export function useRestoreAdminConsultant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreAdminConsultant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "consultants"] });
    },
  });
}

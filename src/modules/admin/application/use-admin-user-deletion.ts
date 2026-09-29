"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminDeleteUser,
  getUserDeletionPreview,
  type HardDeleteAccountType,
} from "../infrastructure/admin-api";

/** Prévia da exclusão (apaga / anonimiza / bloqueado). Sempre fresca: decide o texto do botão. */
export function useUserDeletionPreview(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["admin", "user-deletion-preview", userId],
    queryFn: () => getUserDeletionPreview(userId!),
    enabled: !!userId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

/**
 * Exclui a conta (a API escolhe apagar ou anonimizar). A mesma pessoa aparece em
 * Usuários, Freelancers, Empresas e Contratantes Casa — invalida o painel todo.
 */
export function useAdminDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      reason,
      accountType,
    }: {
      userId: string;
      reason: string;
      accountType?: HardDeleteAccountType;
    }) => adminDeleteUser(userId, reason, accountType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

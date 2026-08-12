"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateAdminProvider,
  type UpdateAdminProviderPayload,
} from "../infrastructure/admin-api";

/**
 * Corrige o cadastro de um freelancer pelo painel.
 *
 * Invalida a listagem inteira porque a correção mais comum — acrescentar um
 * cargo — muda a linha na tabela e também o resultado do filtro por função. Sem
 * isso, o operador salva e continua vendo o cadastro errado.
 */
export function useAdminUpdateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateAdminProviderPayload }) =>
      updateAdminProvider(userId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "providers"] });
    },
  });
}

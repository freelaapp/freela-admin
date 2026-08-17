"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminCasaContractors,
  updateAdminCasaContractor,
  type UpdateCasaContractorPayload,
} from "../infrastructure/casa-contractors-api";
import { adminHardDeleteUser } from "../infrastructure/admin-api";

export function useAdminCasaContractors() {
  return useQuery({
    queryKey: ["admin", "casa-contractors"],
    queryFn: getAdminCasaContractors,
    staleTime: 30000,
  });
}

/**
 * Edita o cadastro do contratante do Casa.
 *
 * ⚠️ Empresa e Casa são cadastros SEPARADOS (`bares_restaurantes.contractors` ≠
 * `freela_em_casa.contractors`). Editar aqui não muda o de Empresa da mesma
 * empresa — decisão consciente de não unificar, para não mexer em fluxo que já
 * está em produção.
 */
export function useAdminUpdateCasaContractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCasaContractorPayload }) =>
      updateAdminCasaContractor(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "casa-contractors"] });
    },
  });
}

/**
 * Exclusão DEFINITIVA do contratante do Casa.
 *
 * A rota é global (`/v1/admin/users/:id/hard-delete`) — apaga a PESSOA, não o
 * cadastro de um módulo. Ou seja: excluir daqui remove também o cadastro de
 * Empresa da mesma pessoa, ao contrário da edição, que é por módulo. A tela
 * precisa dizer isso.
 */
export function useAdminHardDeleteCasaContractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminHardDeleteUser(userId, reason, "contractor"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "casa-contractors"] });
      qc.invalidateQueries({ queryKey: ["admin", "contractors"] });
    },
  });
}

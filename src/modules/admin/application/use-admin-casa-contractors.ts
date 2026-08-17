"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminCasaContractors,
  updateAdminCasaContractor,
  type UpdateCasaContractorPayload,
} from "../infrastructure/casa-contractors-api";

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

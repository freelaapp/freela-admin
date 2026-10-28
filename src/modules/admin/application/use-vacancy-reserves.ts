"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminCancelReserveCall,
  adminOpenReserveCall,
  getVacancyReserves,
  type AdminReserveCallReason,
} from "../infrastructure/admin-api";

/**
 * Reservas da vaga aberta no modal. Erro (vaga de outro módulo, API anterior)
 * não tenta de novo: o painel some em vez de insistir.
 */
export function useVacancyReserves(vacancyId: string | null) {
  return useQuery({
    queryKey: ["admin", "vacancy-reserves", vacancyId],
    queryFn: () => getVacancyReserves(vacancyId as string),
    enabled: !!vacancyId,
    retry: false,
    staleTime: 15000,
  });
}

/**
 * Chamar a reserva e cancelar a chamada mexem no escolhido: recarrega as
 * reservas e a lista de candidatos da vaga.
 */
function useRefreshReserves(vacancyId: string | null) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: ["admin", "vacancy-reserves", vacancyId],
    });
    queryClient.invalidateQueries({
      queryKey: ["admin", "vacancy-candidacies", vacancyId],
    });
  };
}

export function useOpenReserveCall(vacancyId: string | null) {
  const refresh = useRefreshReserves(vacancyId);
  return useMutation({
    mutationFn: (input: {
      reason: AdminReserveCallReason;
      note?: string;
      idempotencyKey: string;
    }) =>
      adminOpenReserveCall(
        vacancyId as string,
        { reason: input.reason, ...(input.note ? { note: input.note } : {}) },
        input.idempotencyKey,
      ),
    onSuccess: refresh,
  });
}

export function useCancelReserveCall(vacancyId: string | null) {
  const refresh = useRefreshReserves(vacancyId);
  return useMutation({
    mutationFn: (callId: string) =>
      adminCancelReserveCall(vacancyId as string, callId),
    onSuccess: refresh,
  });
}

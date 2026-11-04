"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSuspension,
  keepInfraction,
  liftSuspension,
  listSuspensions,
  registerSuspensionConversation,
  type SuspensionFilter,
  type SuspensionLiftReason,
} from "../infrastructure/suspensions-api";
import { isPenaltyLadderDisabled } from "./suspensions-presentation";

const KEY = ["admin", "suspensions"] as const;

/**
 * Suspensões (fluxo v2, fatia G). Chave desligada na API (404 `FEATURE_DISABLED`): não tenta de
 * novo; a página diz que as consequências novas ainda não estão ligadas.
 */
export function useSuspensions(filter: SuspensionFilter, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "list", filter],
    queryFn: () => listSuspensions(filter),
    enabled,
    retry: (count, error) => !isPenaltyLadderDisabled(error) && count < 2,
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: KEY });
}

export function useCreateSuspension() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: Parameters<typeof createSuspension>[0]) => createSuspension(body),
    onSettled: refresh,
  });
}

export function useLiftSuspension() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { id: string; reason: SuspensionLiftReason; note?: string }) =>
      liftSuspension(input.id, {
        reason: input.reason,
        ...(input.note ? { note: input.note } : {}),
      }),
    onSettled: refresh,
  });
}

export function useRegisterConversation() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { id: string; note?: string }) =>
      registerSuspensionConversation(input.id, input.note ? { note: input.note } : {}),
    onSettled: refresh,
  });
}

export function useKeepInfraction() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { infractionId: string; note: string }) =>
      keepInfraction(input.infractionId, input.note),
    onSettled: refresh,
  });
}

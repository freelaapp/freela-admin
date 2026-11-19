"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  decideOccurrence,
  getOccurrence,
  listOccurrences,
  revokeOccurrenceDecision,
  type DecideOccurrenceBody,
  type OccurrenceTab,
} from "../infrastructure/occurrences-api";
import { isOccurrencesDisabled } from "./occurrences-presentation";

const KEY = ["admin", "occurrences"] as const;

/** A fila (D5, fatia C2). Chave desligada (404 `FEATURE_DISABLED`): não tenta de novo. */
export function useOccurrences(tab: OccurrenceTab, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "list", tab],
    queryFn: () => listOccurrences(tab),
    enabled,
    retry: (count, error) => !isOccurrencesDisabled(error) && count < 2,
  });
}

export function useOccurrence(infractionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "detail", infractionId],
    queryFn: () => getOccurrence(infractionId as string),
    enabled: enabled && Boolean(infractionId),
    retry: (count, error) => !isOccurrencesDisabled(error) && count < 2,
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: KEY }),
      // A decisão mexe nas suspensões (levanta, troca, registra a conversa).
      queryClient.invalidateQueries({ queryKey: ["admin", "suspensions"] }),
    ]);
}

export function useDecideOccurrence() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { infractionId: string; body: DecideOccurrenceBody }) =>
      decideOccurrence(input.infractionId, input.body),
    onSettled: refresh,
  });
}

export function useRevokeOccurrenceDecision() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { decisionId: string; reason: string }) =>
      revokeOccurrenceDecision(input.decisionId, input.reason),
    onSettled: refresh,
  });
}

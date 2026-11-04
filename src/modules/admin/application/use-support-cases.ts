"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assumeSupportCase,
  closeSupportCase,
  getSupportCase,
  listSupportCases,
  recordSupportContact,
  type SupportCaseFilter,
} from "../infrastructure/support-cases-api";
import { isSupportQueueDisabled } from "./support-queue-presentation";

const KEY = ["admin", "support-cases"] as const;

/**
 * A fila do suporte, atualizada a cada 60 s (como a Confirmação do dia). Chave desligada na API
 * (404 `FEATURE_DISABLED`): não tenta de novo nem recarrega; a página diz que a fila ainda não
 * está ligada.
 */
export function useSupportCases(filter: SupportCaseFilter, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "list", filter],
    queryFn: () => listSupportCases(filter),
    enabled,
    retry: (count, error) => !isSupportQueueDisabled(error) && count < 2,
    refetchInterval: (query) =>
      isSupportQueueDisabled(query.state.error) ? false : 60_000,
  });
}

/** Um caso (contatos, quem está na lista e os dados das mensagens), quando um diálogo abre. */
export function useSupportCase(id: string | null) {
  return useQuery({
    queryKey: [...KEY, "detail", id],
    queryFn: () => getSupportCase(id as string),
    enabled: !!id,
    retry: false,
  });
}

/** Assumir, registrar contato e fechar mudam a fila: recarrega a lista e o caso. */
function useRefreshSupportCases() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: KEY });
}

export function useAssumeSupportCase() {
  const refresh = useRefreshSupportCases();
  return useMutation({
    mutationFn: (id: string) => assumeSupportCase(id),
    onSettled: refresh,
  });
}

export function useRecordSupportContact() {
  const refresh = useRefreshSupportCases();
  return useMutation({
    mutationFn: (input: {
      id: string;
      body: Parameters<typeof recordSupportContact>[1];
    }) => recordSupportContact(input.id, input.body),
    onSuccess: refresh,
  });
}

export function useCloseSupportCase() {
  const refresh = useRefreshSupportCases();
  return useMutation({
    mutationFn: (input: {
      id: string;
      body: Parameters<typeof closeSupportCase>[1];
    }) => closeSupportCase(input.id, input.body),
    onSettled: refresh,
  });
}

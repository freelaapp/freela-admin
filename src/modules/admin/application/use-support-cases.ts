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

/** De quanto em quanto a fila se atualiza sozinha, com a aba aberta (noite 17→18/11, C3). */
export const SUPPORT_QUEUE_POLL_MS = 30_000;
/** Trocar de aba (Abertos / Comigo / Fechados hoje) com a lista mais velha que isto recarrega. */
const SUPPORT_QUEUE_STALE_MS = 15_000;

/**
 * A fila do suporte acompanha as vagas (noite 17→18/11, C3; antes era 60 s e o padrão global de
 * 5 min sem recarga ao voltar para a aba):
 *  - a cada 30 s com a aba do navegador visível (em segundo plano o TanStack pausa);
 *  - na volta para a aba do navegador (o padrão global desliga isso; aqui liga);
 *  - ao trocar de aba da fila, se a lista tem mais de 15 s.
 * Chave desligada na API (404 `FEATURE_DISABLED`): não tenta de novo nem recarrega; a página diz
 * que a fila ainda não está ligada.
 */
export function useSupportCases(filter: SupportCaseFilter, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "list", filter],
    queryFn: () => listSupportCases(filter),
    enabled,
    staleTime: SUPPORT_QUEUE_STALE_MS,
    retry: (count, error) => !isSupportQueueDisabled(error) && count < 2,
    refetchInterval: (query) =>
      isSupportQueueDisabled(query.state.error) ? false : SUPPORT_QUEUE_POLL_MS,
    refetchOnWindowFocus: (query) => !isSupportQueueDisabled(query.state.error),
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

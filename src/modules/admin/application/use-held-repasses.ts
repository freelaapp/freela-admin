"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorOf } from "../infrastructure/api-error";
import {
  getVacancyRepasse,
  listFailedWithdrawals,
  listHeldRepasses,
  markRepassePaidExternally,
  releaseHeldRepasse,
  retryWithdrawal,
  type HeldRepassesParams,
  type MarkPaidExternallyInput,
} from "../infrastructure/held-repasses-api";
import { paidExternallyErrorOf, releaseErrorOf } from "./held-repasses-presentation";
import { billingKeys } from "./use-admin-billing";

/** Sob o prefixo `admin/billing`: toda ação de fatura (ex.: baixa manual) também recarrega a lista. */
export const heldRepassesKey = (params: HeldRepassesParams) =>
  [...billingKeys.all, "held-repasses", params] as const;

/** 4xx não muda tentando de novo (403 sem FINANCE, 404 rota ainda fora do ar). */
function retryUnlessClientError(failureCount: number, error: unknown): boolean {
  const status = apiErrorOf(error).status;
  if (status !== null && status >= 400 && status < 500) return false;
  return failureCount < 2;
}

/**
 * Recarga periódica da lista: a cada minuto (o teto passa e a varredura paga
 * sozinha), MENOS quando a rota dá 404 (API ainda sem o #603): aí para, em vez
 * de pedir uma rota que não existe a cada minuto.
 */
export function heldRefetchInterval(error: unknown): number | false {
  return apiErrorOf(error).status === 404 ? false : 60000;
}

/** Lista "Aguardando fatura" (ADR-017). O painel não recarrega ao voltar para a aba do navegador. */
export function useHeldRepasses(params: HeldRepassesParams) {
  return useQuery({
    queryKey: heldRepassesKey(params),
    queryFn: () => listHeldRepasses(params),
    placeholderData: keepPreviousData,
    staleTime: 15000,
    refetchInterval: (query) => heldRefetchInterval(query.state.error),
    retry: retryUnlessClientError,
  });
}

/**
 * "Pagar agora". Depois (deu certo ou a lista estava velha): a lista e os cards
 * dos retidos, o resumo das faturas (o "Adiantado"), a lista de repasses e o
 * resumo do Financeiro.
 */
export function useReleaseHeldRepasse() {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: billingKeys.all }),
      qc.invalidateQueries({ queryKey: ["admin", "repasses"] }),
      qc.invalidateQueries({ queryKey: ["admin", "finance"] }),
    ]);
  return useMutation({
    mutationFn: (input: { repasseId: string; reason: string }) =>
      releaseHeldRepasse(input.repasseId, { reason: input.reason }),
    onSuccess: () => refresh(),
    onError: (error) => {
      if (releaseErrorOf(error).refresh) return refresh();
    },
  });
}

/** Saques parados: a fila do "Reenviar saque". 404 (API sem a rota) não tenta de novo nem recarrega. */
export function useFailedWithdrawals() {
  return useQuery({
    queryKey: ["admin", "repasses", "failed-withdrawals"] as const,
    queryFn: listFailedWithdrawals,
    staleTime: 30000,
    refetchInterval: (query) => (apiErrorOf(query.state.error).status === 404 ? false : 120000),
    retry: retryUnlessClientError,
  });
}

/** "Reenviar saque": depois (deu certo ou a lista estava velha), recarrega a fila e os repasses. */
export function useRetryWithdrawal() {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["admin", "repasses"] }),
      qc.invalidateQueries({ queryKey: ["admin", "finance"] }),
    ]);
  return useMutation({
    mutationFn: (input: { repasseId: string; reason: string }) =>
      retryWithdrawal(input.repasseId, { reason: input.reason }),
    onSuccess: refresh,
    onError: refresh,
  });
}

/** O repasse da vaga (detalhe da vaga). Sem FINANCE (403) ou rota fora do ar (404): sem bloco. */
export const vacancyRepasseKey = (vacancyId: string) => ["admin", "repasses", "by-vacancy", vacancyId] as const;

export function useVacancyRepasse(vacancyId: string | null) {
  return useQuery({
    queryKey: vacancyRepasseKey(vacancyId ?? ""),
    queryFn: () => getVacancyRepasse(vacancyId as string),
    enabled: !!vacancyId,
    staleTime: 15000,
    retry: retryUnlessClientError,
  });
}

/**
 * "Marcar como pago por fora" (23/11/2026). Depois (deu certo ou a lista estava
 * velha): a lista e os cards dos retidos, o resumo das faturas (o "Adiantado"),
 * a lista de repasses (inclusive o repasse da vaga) e o resumo do Financeiro.
 */
export function useMarkRepassePaidExternally() {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: billingKeys.all }),
      qc.invalidateQueries({ queryKey: ["admin", "repasses"] }),
      qc.invalidateQueries({ queryKey: ["admin", "finance"] }),
    ]);
  return useMutation({
    mutationFn: (input: MarkPaidExternallyInput & { repasseId: string }) =>
      markRepassePaidExternally(input.repasseId, input),
    onSuccess: () => refresh(),
    onError: (error) => {
      if (paidExternallyErrorOf(error, { name: null, amountInCents: 0 }).refresh) return refresh();
    },
  });
}

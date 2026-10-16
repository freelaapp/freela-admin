"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorOf } from "../infrastructure/api-error";
import {
  listHeldRepasses,
  releaseHeldRepasse,
  type HeldRepassesParams,
} from "../infrastructure/held-repasses-api";
import { releaseErrorOf } from "./held-repasses-presentation";
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
 * Lista "Aguardando fatura" (ADR-017). Recarrega a cada minuto: o teto passa e a
 * varredura paga sozinha (o painel não recarrega ao voltar para a aba do navegador).
 */
export function useHeldRepasses(params: HeldRepassesParams) {
  return useQuery({
    queryKey: heldRepassesKey(params),
    queryFn: () => listHeldRepasses(params),
    placeholderData: keepPreviousData,
    staleTime: 15000,
    refetchInterval: 60000,
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiErrorOf } from "../infrastructure/api-error";
import { getAsaasBalance, resolveAsaasTopup, type ResolveOutcome } from "../infrastructure/asaas-balance-api";

export const asaasBalanceKey = ["admin", "asaas-balance"] as const;

/** Saldo da Asaas + recargas. 4xx (sem FINANCE, rota fora do ar) não tenta de novo nem recarrega. */
export function useAsaasBalance() {
  return useQuery({
    queryKey: asaasBalanceKey,
    queryFn: getAsaasBalance,
    staleTime: 30000,
    refetchInterval: (query) => {
      const status = apiErrorOf(query.state.error).status;
      return status !== null && status >= 400 && status < 500 ? false : 120000;
    },
    retry: (count, error) => {
      const status = apiErrorOf(error).status;
      if (status !== null && status >= 400 && status < 500) return false;
      return count < 2;
    },
  });
}

/** "Resolver": depois (deu certo ou a lista estava velha), recarrega o painel. */
export function useResolveAsaasTopup() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: asaasBalanceKey });
  return useMutation({
    mutationFn: (input: { topupId: string; outcome: ResolveOutcome; reason: string }) =>
      resolveAsaasTopup(input.topupId, { outcome: input.outcome, reason: input.reason }),
    onSuccess: refresh,
    onError: refresh,
  });
}

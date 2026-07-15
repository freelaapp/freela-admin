"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  getFinanceSummary,
  getFinanceTransactions,
  type FinancePeriodParams,
  type FinanceTransactionParams,
} from "../infrastructure/admin-api";

/**
 * Resumo financeiro. O saldo é AO VIVO dos gateways, então revalidamos em
 * intervalo curto; `keepPreviousData` evita o flash do spinner ao trocar o período.
 */
export function useFinanceSummary(params: FinancePeriodParams) {
  return useQuery({
    queryKey: ["admin", "finance", "summary", params],
    queryFn: () => getFinanceSummary(params),
    placeholderData: keepPreviousData,
    staleTime: 15000,
    refetchInterval: 60000,
  });
}

export function useFinanceTransactions(params: FinanceTransactionParams) {
  return useQuery({
    queryKey: ["admin", "finance", "transactions", params],
    queryFn: () => getFinanceTransactions(params),
    placeholderData: keepPreviousData,
    staleTime: 15000,
  });
}

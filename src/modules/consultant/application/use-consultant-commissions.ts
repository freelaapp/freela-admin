"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyCommissionDashboard, getMyStatement, getMyWallet } from "../infrastructure/consultant-commissions-api";
import type { StatementFilter } from "@/lib/commissions/types";

const KEY = ["consultant", "commission"] as const;

export function useMyCommissionDashboard(range: { from?: string; to?: string }) {
  return useQuery({
    queryKey: [...KEY, "dashboard", range.from ?? null, range.to ?? null],
    queryFn: () => getMyCommissionDashboard(range),
    placeholderData: (previous) => previous,
  });
}

export function useMyWallet() {
  return useQuery({ queryKey: [...KEY, "wallet"], queryFn: getMyWallet, staleTime: 15_000 });
}

export function useMyStatement(filter: StatementFilter) {
  return useQuery({
    queryKey: [...KEY, "statement", filter],
    queryFn: () => getMyStatement(filter),
    placeholderData: (previous) => previous,
  });
}

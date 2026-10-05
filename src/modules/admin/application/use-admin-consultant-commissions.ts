"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addCommissionAdjustment,
  createCommissionRule,
  getCommissionDashboard,
  getCommissionRules,
  getCommissionStatement,
  getCommissionsSummary,
  previewCommissionPayout,
  registerCommissionPayout,
  reverseCommissionPayout,
} from "../infrastructure/consultant-commissions-api";
import type { CommissionRulePayload, RegisterPayoutPayload, StatementFilter } from "@/lib/commissions/types";

const key = (id: string) => ["admin", "consultants", id, "commission"] as const;

/** Toda escrita mexe em saldo, extrato, painel e lista — invalida tudo da comissão. */
function useInvalidateCommission(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: key(id) });
    qc.invalidateQueries({ queryKey: ["admin", "consultants"] });
    qc.invalidateQueries({ queryKey: ["admin", "consultant-commissions-summary"] });
  };
}

export function useCommissionsSummary() {
  return useQuery({ queryKey: ["admin", "consultant-commissions-summary"], queryFn: getCommissionsSummary, staleTime: 30_000 });
}

export function useCommissionRules(id: string) {
  return useQuery({ queryKey: [...key(id), "rules"], queryFn: () => getCommissionRules(id), enabled: !!id });
}

export function useCreateCommissionRule(id: string) {
  const invalidate = useInvalidateCommission(id);
  return useMutation({ mutationFn: (payload: CommissionRulePayload) => createCommissionRule(id, payload), onSuccess: invalidate });
}

export function useCommissionDashboard(id: string, range: { from?: string; to?: string }) {
  return useQuery({
    queryKey: [...key(id), "dashboard", range.from ?? null, range.to ?? null],
    queryFn: () => getCommissionDashboard(id, range),
    enabled: !!id,
    placeholderData: (previous) => previous,
  });
}

export function useCommissionStatement(id: string, filter: StatementFilter) {
  return useQuery({
    queryKey: [...key(id), "statement", filter],
    queryFn: () => getCommissionStatement(id, filter),
    enabled: !!id,
    placeholderData: (previous) => previous,
  });
}

export function useCommissionAdjustment(id: string) {
  const invalidate = useInvalidateCommission(id);
  return useMutation({
    mutationFn: (payload: { amountInCents: number; reason: string }) => addCommissionAdjustment(id, payload),
    onSuccess: invalidate,
  });
}

export function useCommissionPayoutPreview(id: string, periodEnd: string | null) {
  return useQuery({
    queryKey: [...key(id), "payout-preview", periodEnd],
    queryFn: () => previewCommissionPayout(id, periodEnd as string),
    enabled: !!id && !!periodEnd,
    staleTime: 0,
  });
}

export function useRegisterCommissionPayout(id: string) {
  const invalidate = useInvalidateCommission(id);
  return useMutation({ mutationFn: (payload: RegisterPayoutPayload) => registerCommissionPayout(id, payload), onSuccess: invalidate });
}

export function useReverseCommissionPayout(id: string) {
  const invalidate = useInvalidateCommission(id);
  return useMutation({
    mutationFn: ({ payoutId, reason }: { payoutId: string; reason: string }) => reverseCommissionPayout(id, payoutId, reason),
    onSuccess: invalidate,
  });
}

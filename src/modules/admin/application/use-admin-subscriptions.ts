"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAxiosErrorMessage } from "./use-admin-cancel-vacancy";
import {
  adjustQuota,
  assignPlan,
  extendPeriod,
  getSubscription,
  grantCourtesy,
  listSubscriptions,
  revokeCourtesy,
  type ListParams,
  type PlanCode,
} from "../infrastructure/subscriptions-api";

const LIST_KEY = ["admin", "subscriptions"] as const;
const detailKey = (storeId: string) => ["admin", "subscriptions", storeId] as const;

export function useSubscriptions(params: ListParams) {
  return useQuery({
    queryKey: [...LIST_KEY, params],
    queryFn: () => listSubscriptions(params),
    staleTime: 30_000,
  });
}

export function useSubscriptionDetail(storeId: string | null) {
  return useQuery({
    queryKey: detailKey(storeId ?? ""),
    queryFn: () => getSubscription(storeId!),
    enabled: !!storeId,
  });
}

/**
 * Toda mutação invalida a lista E o detalhe da loja: o painel mostra o plano nos
 * dois lugares, e atualizar só um deixa a tela contando duas versões da mesma
 * assinatura.
 */
export function useSubscriptionMutations(storeId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: LIST_KEY });
    if (storeId) qc.invalidateQueries({ queryKey: detailKey(storeId) });
  };

  const changePlan = useMutation({
    mutationFn: (vars: { storeId: string; planCode: PlanCode }) =>
      assignPlan(vars.storeId, vars.planCode),
    onSuccess: () => {
      invalidate();
      toast.success("Plano alterado.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao alterar o plano.")),
  });

  const courtesy = useMutation({
    mutationFn: (vars: {
      storeId: string;
      planCode?: PlanCode;
      months: number;
      note?: string;
    }) => grantCourtesy(vars.storeId, vars),
    onSuccess: (_data, vars) => {
      invalidate();
      toast.success(
        vars.months === 1 ? "Um mês de cortesia liberado." : `${vars.months} meses de cortesia liberados.`,
      );
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao conceder a cortesia.")),
  });

  const endCourtesy = useMutation({
    mutationFn: (vars: { storeId: string; note?: string }) =>
      revokeCourtesy(vars.storeId, vars.note),
    onSuccess: () => {
      invalidate();
      toast.success("Cortesia encerrada. O plano continua.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao encerrar a cortesia.")),
  });

  const extend = useMutation({
    mutationFn: (vars: { storeId: string; days: number; note?: string }) =>
      extendPeriod(vars.storeId, vars),
    onSuccess: (_data, vars) => {
      invalidate();
      toast.success(`Ciclo estendido em ${vars.days} dias.`);
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao estender o ciclo.")),
  });

  const quota = useMutation({
    mutationFn: (vars: { storeId: string; delta: number; note?: string }) =>
      adjustQuota(vars.storeId, vars),
    onSuccess: (_data, vars) => {
      invalidate();
      toast.success(
        vars.delta > 0 ? `${vars.delta} vaga(s) liberada(s).` : `${-vars.delta} vaga(s) descontada(s).`,
      );
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao ajustar a cota.")),
  });

  return { changePlan, courtesy, endCourtesy, extend, quota };
}

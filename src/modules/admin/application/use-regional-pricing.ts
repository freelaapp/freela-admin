"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAxiosErrorMessage } from "./use-admin-cancel-vacancy";
import {
  deleteRegionalRule,
  getRegionalPricing,
  upsertRegionalRule,
  type RegionalModule,
  type UpsertRegionalRuleInput,
} from "../infrastructure/regional-pricing-api";

const KEY = (module: RegionalModule) => ["admin", "regional-pricing", module] as const;

export function useRegionalPricing(module: RegionalModule) {
  return useQuery({ queryKey: KEY(module), queryFn: () => getRegionalPricing(module), staleTime: 30000 });
}

export function useRegionalPricingMutations(module: RegionalModule) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY(module) });

  const upsert = useMutation({
    mutationFn: (v: { uf: string; city: string; input: UpsertRegionalRuleInput }) =>
      upsertRegionalRule(v.uf, v.city, v.input),
    onSuccess: () => {
      invalidate();
      toast.success("Índice salvo.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao salvar o índice.")),
  });

  const remove = useMutation({
    mutationFn: (v: { uf: string; city: string }) => deleteRegionalRule(v.uf, v.city, module),
    onSuccess: () => {
      invalidate();
      toast.success("Regra removida — a praça volta a herdar UF/nacional.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao remover a regra.")),
  });

  return { upsert, remove };
}

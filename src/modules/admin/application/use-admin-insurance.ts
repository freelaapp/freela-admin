"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getInsuranceCoverage,
  getInsuranceCoverages,
  getInsuranceHealthChecks,
  getInsuranceStatus,
  runInsuranceHealthCheck,
  type CoverageFilters,
} from "../infrastructure/insurance-api";

const INSURANCE_KEY = ["admin", "insurance"] as const;

export function useInsuranceStatus() {
  return useQuery({
    queryKey: [...INSURANCE_KEY, "status"],
    queryFn: getInsuranceStatus,
    staleTime: 30_000,
  });
}

export function useInsuranceHealthChecks(limit = 30) {
  return useQuery({
    queryKey: [...INSURANCE_KEY, "health-checks", limit],
    queryFn: () => getInsuranceHealthChecks(limit),
    staleTime: 30_000,
  });
}

export function useInsuranceCoverages(filters: CoverageFilters) {
  return useQuery({
    queryKey: [...INSURANCE_KEY, "coverages", filters],
    queryFn: () => getInsuranceCoverages(filters),
    staleTime: 15_000,
  });
}

/**
 * Só busca quando há um id selecionado. O detalhe consulta a IZA ao vivo, então
 * disparar sem seleção seria uma chamada externa por render.
 */
export function useInsuranceCoverage(id: string | null) {
  return useQuery({
    queryKey: [...INSURANCE_KEY, "coverage", id],
    queryFn: () => getInsuranceCoverage(id as string),
    enabled: Boolean(id),
    staleTime: 0,
  });
}

export function useRunHealthCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runInsuranceHealthCheck,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...INSURANCE_KEY, "status"] });
      queryClient.invalidateQueries({ queryKey: [...INSURANCE_KEY, "health-checks"] });
    },
  });
}

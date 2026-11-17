"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  DashboardUnavailableError,
  getAdminDashboard,
  getVacancyStages,
  type AdminDashboardParams,
  type VacancyStagesScope,
} from "../infrastructure/dashboard-api";

/** Rota ausente (API antiga) não melhora tentando de novo; o resto tenta 2 vezes. */
const retryUnlessUnavailable = (failures: number, error: unknown) =>
  !(error instanceof DashboardUnavailableError) && failures < 2;

/** Totais, indicadores do período e Top 10. Recarrega sozinho a cada 60 s. */
export function useAdminDashboard(params: AdminDashboardParams) {
  const period = params.period || undefined;
  const custom = period === "custom";
  const from = custom ? params.from || undefined : undefined;
  const to = custom ? params.to || undefined : undefined;
  return useQuery({
    queryKey: ["admin", "dashboard", { period, from, to }],
    queryFn: () => getAdminDashboard({ period, from, to }),
    // Personalizado incompleto não vale request: a API cairia no padrão.
    enabled: !custom || Boolean(from && to),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: retryUnlessUnavailable,
  });
}

/** Status das vagas (S1–S7): foto do momento, com seletor próprio. */
export function useVacancyStages(scope: VacancyStagesScope) {
  return useQuery({
    queryKey: ["admin", "dashboard", "vacancy-stages", scope],
    queryFn: () => getVacancyStages(scope),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: retryUnlessUnavailable,
  });
}

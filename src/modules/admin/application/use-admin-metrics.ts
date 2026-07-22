"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getAdminMetrics, type AdminMetricsParams } from "../infrastructure/admin-api";

export function useAdminMetrics(params?: AdminMetricsParams) {
  const city = params?.city || undefined;
  const role = params?.role || undefined;
  const period = params?.period || undefined;
  // `from`/`to` só existem no período personalizado; fora dele nem entram na
  // chave do cache, senão trocar de preset refetcharia à toa.
  const custom = period === "custom";
  const from = custom ? params?.from || undefined : undefined;
  const to = custom ? params?.to || undefined : undefined;
  // Intervalo personalizado incompleto não vale request: a API cairia no
  // default e o painel mostraria o mês rotulado como o intervalo escolhido.
  const enabled = !custom || Boolean(from && to);
  return useQuery({
    queryKey: ["admin", "metrics", { city, role, period, from, to }],
    queryFn: () => getAdminMetrics({ city, role, period, from, to }),
    enabled,
    // Mantém os números anteriores enquanto refaz com o novo filtro (sem flash do spinner).
    placeholderData: keepPreviousData,
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

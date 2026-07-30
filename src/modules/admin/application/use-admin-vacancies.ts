"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminAllVacancies } from "../infrastructure/admin-api";

/**
 * `pollMs` liga o refetch automático. Só o Modo Painel usa: ele fica aberto numa
 * TV o dia inteiro, sem ninguém para apertar F5, então precisa se atualizar
 * sozinho. A tabela normal continua sem polling (o padrão de antes).
 */
export function useAdminVacancies(consultantId?: string, pollMs?: number) {
  return useQuery({
    queryKey: ["admin", "vacancies", consultantId ?? null],
    queryFn: () => getAdminAllVacancies(consultantId),
    staleTime: 30000,
    refetchInterval: pollMs ?? false,
    // A TV não tem foco de janela; sem isto o refetch pararia quando o
    // navegador considerasse a aba em segundo plano.
    refetchIntervalInBackground: Boolean(pollMs),
  });
}

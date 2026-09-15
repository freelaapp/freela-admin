"use client";

import { useQuery } from "@tanstack/react-query";

import { getVacancyPriceHistory } from "../infrastructure/admin-api";

/**
 * Histórico de preço de uma vaga (linha do tempo de valores) para o modal de
 * detalhes. Fica desligado até haver `vacancyId`. `staleTime` alto porque o
 * histórico só muda quando alguém (re)precifica/negocia — não precisa refazer a
 * cada foco de janela.
 */
export function useVacancyPriceHistory(vacancyId: string | null) {
  return useQuery({
    queryKey: ["admin", "vacancy-price-history", vacancyId],
    queryFn: () => getVacancyPriceHistory(vacancyId as string),
    enabled: !!vacancyId,
    staleTime: 30000,
  });
}

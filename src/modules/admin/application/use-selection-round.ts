"use client";

import { useQuery } from "@tanstack/react-query";
import { getVacancySelectionRound } from "../infrastructure/selection-round-api";
import { isSelectionDisabled } from "./selection-round-presentation";

/**
 * A rodada de seleção da vaga (fatia E), quando o modal abre. Chave desligada na API (404
 * `FEATURE_DISABLED`): não tenta de novo e a seção não aparece.
 */
export function useVacancySelectionRound(vacancyId: string | null | undefined) {
  return useQuery({
    queryKey: ["admin", "selection-round", vacancyId],
    queryFn: () => getVacancySelectionRound(vacancyId as string),
    enabled: !!vacancyId,
    retry: (count, error) => !isSelectionDisabled(error) && count < 2,
    staleTime: 30_000,
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getVacancySelectionRound, releaseVacancyCandidateList } from "../infrastructure/selection-round-api";
import { isSelectionDisabled } from "./selection-round-presentation";

/**
 * A rodada de seleção da vaga (fatia E), quando o modal abre. Sem a rodada na API (qualquer 404:
 * a chave desligada ou a API de antes): não tenta de novo e a seção não aparece.
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

/** "Liberar a lista agora": a resposta é a rodada nova, que já entra no cache da seção. */
export function useReleaseCandidateList(vacancyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => releaseVacancyCandidateList(vacancyId, note),
    onSuccess: (view) => {
      qc.setQueryData(["admin", "selection-round", vacancyId], view);
    },
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  chooseVacancyTeam,
  getVacancySelectionRound,
  hurryVacancySelection,
  releaseVacancyCandidateList,
  type HurryMinutes,
} from "../infrastructure/selection-round-api";
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

/** "Selecionar agora": a resposta é a rodada nova (mais o `hurried`), que já entra no cache. */
export function useHurrySelection(vacancyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { minutes: HurryMinutes; note?: string }) =>
      hurryVacancySelection(vacancyId, input),
    onSuccess: (result) => {
      qc.setQueryData(["admin", "selection-round", vacancyId], result);
    },
  });
}

/**
 * "Escolher titular e suplentes": a vaga fecha (ou o Pix é pedido), a rodada fecha e os suplentes
 * mudam. Recarrega tudo no fim, com sucesso ou não: num erro de rede não se sabe se deu certo.
 */
export function useChooseTeam(vacancyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { principalCandidacyId: string; reserveCandidacyIds: string[] }) =>
      chooseVacancyTeam(vacancyId, input),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin", "selection-round", vacancyId] });
      qc.invalidateQueries({ queryKey: ["admin", "vacancy-candidacies", vacancyId] });
      qc.invalidateQueries({ queryKey: ["admin", "vacancy-reserves", vacancyId] });
      qc.invalidateQueries({ queryKey: ["admin", "vacancies"] });
    },
  });
}

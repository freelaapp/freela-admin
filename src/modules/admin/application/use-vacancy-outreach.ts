import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getVacancyOutreach,
  outreachKey,
  sendVacancyStageMessage,
  type OutreachStage,
} from "../infrastructure/vacancy-outreach-api";

/**
 * Avisos já enviados, indexados por (vaga, etapa).
 *
 * Uma consulta só para o painel inteiro, não uma por card: são dezenas de
 * vagas na tela, e o dado é o mesmo para todas.
 */
export function useVacancyOutreach() {
  const query = useQuery({
    queryKey: ["admin", "vacancy-outreach"],
    queryFn: getVacancyOutreach,
    staleTime: 60_000,
  });

  const enviados = new Map<string, string>();
  for (const r of query.data ?? []) {
    enviados.set(outreachKey(r.vacancyId, r.stage), r.lastSentAt);
  }

  return { ...query, enviados };
}

export function useSendVacancyStageMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vacancyId, stage }: { vacancyId: string; stage: OutreachStage }) =>
      sendVacancyStageMessage(vacancyId, stage),
    // Só invalida no sucesso: um card não pode ficar pintado por um envio que
    // a Evolution recusou.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "vacancy-outreach"] }),
  });
}

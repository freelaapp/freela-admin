import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getVacancyOutreach,
  outreachKey,
  resendVacancyGroupMessage,
  sendVacancyStageMessage,
  type OutreachRecord,
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

  // Guarda o registro INTEIRO, não só a data: a coluna Disparo precisa da
  // origem (automático x manual) para dizer o que de fato aconteceu.
  const enviados = new Map<string, string>();
  const registros = new Map<string, OutreachRecord>();
  for (const r of query.data ?? []) {
    const key = outreachKey(r.vacancyId, r.stage);
    enviados.set(key, r.lastSentAt);
    registros.set(key, r);
  }

  return { ...query, enviados, registros };
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

/** Reenvio do anúncio no grupo da cidade. */
export function useResendVacancyGroupMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      vacancyId,
      module = "empresa",
    }: {
      vacancyId: string;
      module?: "empresa" | "casa";
    }) => resendVacancyGroupMessage(vacancyId, module),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "vacancy-outreach"] }),
  });
}

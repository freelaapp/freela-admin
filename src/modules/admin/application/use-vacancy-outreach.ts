import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getCompatibleFreelancers,
  getVacancyOutreach,
  outreachKey,
  resendVacancyGroupMessage,
  sendCompatibleInvites,
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

/**
 * Os 10 freelancers mais compatíveis com a vaga que ainda não se candidataram.
 * Só busca quando `enabled` — a lista é calculada na hora e não vale a pena
 * pagar essa conta a cada modal aberto.
 */
export function useCompatibleFreelancers(vacancyId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "vacancy-compatible-freelancers", vacancyId],
    queryFn: () => getCompatibleFreelancers(vacancyId as string),
    enabled: Boolean(vacancyId) && enabled,
    staleTime: 0,
  });
}

export function useSendCompatibleInvites(vacancyId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userIds, text }: { userIds: string[]; text: string }) =>
      sendCompatibleInvites(vacancyId as string, userIds, text),
    // Refaz a lista: quem foi convidado sai e entram os próximos.
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["admin", "vacancy-compatible-freelancers", vacancyId],
      }),
  });
}

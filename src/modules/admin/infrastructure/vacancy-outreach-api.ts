import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const outreachApi = createAuthedClient("/v1/admins/vacancy-outreach");

/** Etapas em que a vaga está parada esperando o CONTRATANTE. */
export type OutreachStage = "awaitingSelection" | "awaitingPayment";

/** Etapa do anúncio da vaga no grupo da cidade (não é aviso ao contratante). */
export const GROUP_BROADCAST_STAGE = "groupBroadcast";

export interface OutreachRecord {
  vacancyId: string;
  stage: string;
  lastSentAt: string;
  sendCount: number;
}

export async function getVacancyOutreach(): Promise<OutreachRecord[]> {
  const res = await outreachApi.get("");
  return res.data.data ?? [];
}

export async function sendVacancyStageMessage(
  vacancyId: string,
  stage: OutreachStage,
): Promise<{ phone: string; sentAt: string }> {
  const res = await outreachApi.post(`/${vacancyId}`, { stage });
  return res.data.data;
}

/** Chave do par (vaga, etapa) — o mesmo par que a API usa como chave primária. */
export function outreachKey(vacancyId: string, stage: string): string {
  return `${vacancyId}::${stage}`;
}

/**
 * Reenvia o anúncio da vaga no grupo da cidade.
 *
 * Rota do MÓDULO (não a de avisos): quem reenvia é o próprio fluxo de criação
 * da vaga, para o texto do reenvio não divergir do original.
 */
export async function resendVacancyGroupMessage(vacancyId: string): Promise<void> {
  const moduleApi = createAuthedClient("/v1/bars-restaurants/admin");
  await moduleApi.post(`/vacancies/${vacancyId}/resend-group-message`, {});
}

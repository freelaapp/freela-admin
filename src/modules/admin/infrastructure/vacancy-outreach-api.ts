import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const outreachApi = createAuthedClient("/v1/admins/vacancy-outreach");

/** Etapas em que a vaga está parada esperando o CONTRATANTE. */
export type OutreachStage = "awaitingSelection" | "awaitingPayment";

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

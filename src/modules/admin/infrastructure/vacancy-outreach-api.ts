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
  /** Quando o disparo AUTOMÁTICO saiu (o do próprio fluxo de publicação). */
  autoSentAt?: string | null;
  /** Quando alguém do painel apertou o botão. Os dois convivem. */
  manualSentAt?: string | null;
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
export async function resendVacancyGroupMessage(
  vacancyId: string,
  module: "empresa" | "casa" = "empresa",
): Promise<void> {
  // Rota do MÓDULO, não a de avisos: quem reenvia é o próprio fluxo de criação
  // da vaga, para o texto do reenvio não divergir do original — e cada módulo
  // tem o seu.
  const base = module === "casa" ? "/v1/home-services/admin" : "/v1/bars-restaurants/admin";
  const moduleApi = createAuthedClient(base);
  await moduleApi.post(`/vacancies/${vacancyId}/resend-group-message`, {});
}

// ─── Convidar compatíveis ──────────────────────────────────────────────────

/** Freelancer que combina com a vaga e ainda não se candidatou. */
export interface CompatibleFreelancer {
  userId: string;
  providerGlobalId: string | null;
  name: string | null;
  phone: string;
  city: string | null;
  distanceInKm: number | null;
  /** 0–100; null = sem dado da vaga para comparar. */
  matchScore: number | null;
  averageRating: number | null;
  totalCompletedServices: number;
}

export interface CompatibleInvitePreview {
  vacancyId: string;
  /** Texto do convite com `{nome}` — vira o primeiro nome de cada um no envio. */
  template: string;
  /** Quantos já foram convidados para esta vaga (não voltam na lista). */
  alreadyInvited: number;
  candidates: CompatibleFreelancer[];
}

export interface CompatibleInviteResult {
  sent: Array<{ userId: string; name: string | null }>;
  failed: Array<{ userId: string; name: string | null; reason: string }>;
  skipped: number;
}

export async function getCompatibleFreelancers(
  vacancyId: string,
): Promise<CompatibleInvitePreview> {
  const res = await outreachApi.get(`/${vacancyId}/compatible-freelancers`);
  return res.data.data;
}

export async function sendCompatibleInvites(
  vacancyId: string,
  userIds: string[],
  text: string,
): Promise<CompatibleInviteResult> {
  // A API manda as mensagens uma a uma, com intervalo entre elas: 10 convites
  // passam fácil dos 30 s padrão do client.
  const res = await outreachApi.post(
    `/${vacancyId}/compatible-invites`,
    { userIds, text },
    { timeout: 90_000 },
  );
  return res.data.data;
}

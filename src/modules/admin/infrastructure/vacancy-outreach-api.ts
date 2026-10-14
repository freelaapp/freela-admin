import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

import {
  parseOutreachGroupBroadcast,
  parseResendGroupResult,
  type OutreachGroupBroadcast,
  type ResendGroupResult,
} from "./vacancy-group-broadcasts-api";

const outreachApi = createAuthedClient("/v1/admins/vacancy-outreach");

/** Etapas em que a vaga está parada esperando o CONTRATANTE. */
export type OutreachStage = "awaitingSelection" | "awaitingPayment";

/** Etapa do anúncio da vaga no grupo da cidade (não é aviso ao contratante). */
export const GROUP_BROADCAST_STAGE = "groupBroadcast";

export interface OutreachRecord {
  vacancyId: string;
  stage: string;
  /**
   * Último envio confirmado. `null` no registro do Disparo de uma vaga cuja
   * rodada falhou inteira ou ainda está na fila (aí vale `groupBroadcast`).
   */
  lastSentAt: string | null;
  sendCount: number;
  /** Quando o disparo AUTOMÁTICO saiu (o do próprio fluxo de publicação). */
  autoSentAt?: string | null;
  /** Quando alguém do painel apertou o botão. Os dois convivem. */
  manualSentAt?: string | null;
  /**
   * Última rodada nos grupos (cidade da vaga + até 30 km), só no registro
   * `stage: 'groupBroadcast'`. Ausente = API anterior ao registro por grupo: a
   * coluna "Disparo" mostra como antes.
   */
  groupBroadcast?: OutreachGroupBroadcast;
}

export async function getVacancyOutreach(): Promise<OutreachRecord[]> {
  const res = await outreachApi.get("");
  const records: OutreachRecord[] = res.data.data ?? [];
  return records.map((r) => ({
    ...r,
    groupBroadcast: parseOutreachGroupBroadcast((r as { groupBroadcast?: unknown }).groupBroadcast),
  }));
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
 * Reenvia o anúncio da vaga nos grupos.
 *
 * Empresas (API nova): abre uma rodada para TODOS os grupos a até 30 km e
 * responde na hora com `{ roundId, destinations }`; o envio sai em fila (1
 * grupo a cada ~3 s). API antiga / Casa: envia só ao grupo da cidade e não
 * devolve rodada (`roundId: null`).
 */
export async function resendVacancyGroupMessage(
  vacancyId: string,
  module: "empresa" | "casa" = "empresa",
): Promise<ResendGroupResult> {
  // Rota do MÓDULO, não a de avisos: quem reenvia é o próprio fluxo de criação
  // da vaga, para o texto do reenvio não divergir do original — e cada módulo
  // tem o seu.
  const base = module === "casa" ? "/v1/home-services/admin" : "/v1/bars-restaurants/admin";
  const moduleApi = createAuthedClient(base);
  const res = await moduleApi.post(`/vacancies/${vacancyId}/resend-group-message`, {});
  return parseResendGroupResult(res?.data?.data);
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

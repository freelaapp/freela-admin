import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Fila de ocorrências do "confirmou e não foi" (D5, fatia C2; frente E4 de 18/11/2026). Rotas de
 * `/v1/admins/occurrences`, área Freelancers (`FREELANCERS`).
 *
 * ⚠️ A chave da API (`OCCURRENCE_DECISIONS_ENABLED`) nasce desligada. Desligada, toda rota
 * responde 404 `FEATURE_DISABLED`: a página diz que as ocorrências ainda não estão ligadas.
 */
const adminsApi = createAuthedClient("/v1/admins");

export type OccurrenceTab = "open" | "decided" | "all";
export type OccurrenceDecisionKind = "KEEP" | "RELEASE" | "WARNING" | "SUSPEND" | "ANNUL" | "BAN";
export type OccurrenceChoice = "KEEP" | "RELEASE" | "SUSPEND" | "ANNUL";
export type OccurrenceContactResult = "CALL" | "WHATSAPP" | "NO_ANSWER" | "NOT_TRIED";
export type OccurrenceContestAnswer = "ACCEPTED" | "DENIED";
export type OccurrenceContestStatus = "OPEN" | "SENT" | "DENIED" | "ACCEPTED" | "CLOSED";
export type OccurrenceSuspensionState =
  | "DATED"
  | "DATED_AND_CONVERSATION"
  | "CONVERSATION_ONLY"
  | "ENDED"
  | "LIFTED";

export interface OccurrenceItem {
  infractionId: string;
  /** PENDING · CONTESTED · RESOLVED · ANNULLED */
  status: string;
  /** attendance_v2 · contractor_not_arrived · system */
  createdBy: string | null;
  createdAt: string;
  eventAt: string;
  pointsLost: number;
  reputationBefore: number;
  reputationAfter: number;
  person: {
    providerGlobalId: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  vacancy: {
    id: string | null;
    title: string | null;
    date: string | null;
    startTime: string | null;
    jobId: string | null;
    company: { userId: string; name: string | null } | null;
    city: string | null;
    uf: string | null;
  };
  /** A suspensão automática da escada (levantada ou não); nula = a escada não suspendeu. */
  applied: {
    suspensionId: string;
    reasonKey: string | null;
    startsAt: string;
    endsAt: string | null;
    requiresConversation: boolean;
    conversationAt: string | null;
    liftedAt: string | null;
    liftedReason: string | null;
    state: OccurrenceSuspensionState;
  } | null;
  contest: {
    status: OccurrenceContestStatus;
    contestedAt: string | null;
    /** Prazo para contestar (no detalhe, o que vale: alongado pela entrega do aviso). */
    until: string | null;
    reason: string | null;
    justification: string | null;
  };
  /** Contestada e ainda sem resposta. */
  needsContestAnswer: boolean;
  resolution: { at: string; note: string | null; byName: string | null } | null;
  /** A decisão em vigor. */
  decision: {
    id: string;
    decision: OccurrenceDecisionKind;
    suspensionDays: number | null;
    decidedAt: string;
    decidedByName: string | null;
    contestAnswer: OccurrenceContestAnswer | null;
    suspensionEndsAt: string | null;
    suspensionLiftedAt: string | null;
  } | null;
}

export interface OccurrenceSettings {
  /** Desde quando a fila vale (meia-noite de Brasília); nula = fila vazia. */
  since: string | null;
  /** O padrão do "Liberar" (D5): com advertência ou sem nada. */
  releaseDefault: "WARNING" | "NONE";
  /** Os dias da tabela publicada (D6): 7 e 30. */
  suspensionDays: number[];
  /** Os avisos W-OC estão ligados (só então a advertência vai pelo WhatsApp). */
  noticesEnabled: boolean;
}

export interface OccurrenceList extends OccurrenceSettings {
  tab: OccurrenceTab;
  total: number;
  openCount: number;
  items: OccurrenceItem[];
}

export interface OccurrenceDecisionRecord {
  id: string;
  infractionId: string;
  decision: OccurrenceDecisionKind;
  suspensionDays: number | null;
  createdSuspensionId: string | null;
  liftedSuspensionId: string | null;
  contestAnswer: OccurrenceContestAnswer | null;
  whatHappened: string;
  contactResult: OccurrenceContactResult | null;
  providerSaid: string | null;
  decidedByAdminId: string;
  decidedByName: string | null;
  decidedAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
  revokedByName: string | null;
  revokedReason: string | null;
  revokedKind: "ADMIN" | "INFRACTION_ANNULLED" | null;
  suspensionEndsAt: string | null;
  suspensionLiftedAt: string | null;
}

export interface OccurrenceOptions {
  canDecide: boolean;
  needsContestAnswer: boolean;
  /** Contestada depois de uma decisão: só a resposta (negar mantém a decisão). */
  contestOnly: boolean;
  canKeep: boolean;
  canRelease: boolean;
  canSuspend: boolean;
  canAnnul: boolean;
  suspensionDays: number[];
}

export interface OccurrenceDetail extends OccurrenceSettings {
  item: OccurrenceItem;
  decisions: OccurrenceDecisionRecord[];
  history: { days: number; noShows: number; lateWithdrawals: number; suspensions: number };
  options: OccurrenceOptions;
}

export interface DecideOccurrenceBody {
  decision?: OccurrenceChoice;
  warning?: boolean;
  days?: number;
  contestAnswer?: OccurrenceContestAnswer;
  whatHappened: string;
  contactResult: OccurrenceContactResult;
  providerSaid?: string;
}

export interface DecideOccurrenceResult {
  outcome: "DECIDED" | "CONTEST_DENIED" | "ANNULLED";
  decision: OccurrenceDecisionRecord | null;
  contestAnswer: OccurrenceContestAnswer | null;
  effects: {
    conversationRegistered: boolean;
    liftedAutomatic: boolean;
    suspendedUntil: string | null;
    pointsReturned: number | null;
    stillSuspended: boolean;
  };
}

export async function listOccurrences(tab: OccurrenceTab): Promise<OccurrenceList> {
  const res = await adminsApi.get("/occurrences", { params: { tab, limit: 200 } });
  return res.data.data;
}

export async function getOccurrence(infractionId: string): Promise<OccurrenceDetail> {
  const res = await adminsApi.get(`/occurrences/${infractionId}`);
  return res.data.data;
}

export async function decideOccurrence(
  infractionId: string,
  body: DecideOccurrenceBody,
): Promise<DecideOccurrenceResult> {
  const res = await adminsApi.post(`/occurrences/${infractionId}/decision`, body);
  return res.data.data;
}

export async function revokeOccurrenceDecision(
  decisionId: string,
  reason: string,
): Promise<unknown> {
  const res = await adminsApi.post(`/occurrences/decisions/${decisionId}/revoke`, { reason });
  return res.data.data;
}

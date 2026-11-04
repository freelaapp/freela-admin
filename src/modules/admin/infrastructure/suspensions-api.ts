import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Suspensões do freelancer (fluxo de vagas v2, fatia G; designer, lote 2 §5.5). Rotas de
 * `/v1/admins/suspensions`, área Freelancers (`FREELANCERS`, a mesma das infrações).
 *
 * ⚠️ A chave da API (`PENALTY_LADDER_V2_ENABLED`) só liga depois do OK do jurídico. Desligada,
 * toda rota responde 404 `FEATURE_DISABLED`: a página mostra "As consequências novas ainda não
 * estão ligadas."
 */
const adminsApi = createAuthedClient("/v1/admins");

export type SuspensionFilter = "active" | "all";
export type SuspensionReasonKey =
  | "LATE_WITHDRAWAL_REPEAT"
  | "LATE_WITHDRAWAL_FIRST_SHIFT"
  | "NO_SHOW"
  | "NO_SHOW_FIRST_SHIFT"
  | "NO_SHOW_REPEAT"
  | "MANUAL";
export type SuspensionState =
  | "DATED"
  | "DATED_AND_CONVERSATION"
  | "CONVERSATION_ONLY"
  | "ENDED"
  | "LIFTED";
export type SuspensionLiftReason = "CONTEST_ACCEPTED" | "SYSTEM_ERROR" | "OTHER";

export interface SuspensionItem {
  id: string;
  person: {
    providerGlobalId: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  reasonKey: SuspensionReasonKey;
  /** {{1}} do W33 ("uma falta sem aviso"); nulo na suspensão manual. */
  occurrencePhrase: string | null;
  manualReason: string | null;
  startsAt: string;
  /** Meia-noite de Brasília em que volta a poder; nulo = só depois da conversa. */
  endsAt: string | null;
  requiresConversation: boolean;
  conversationAt: string | null;
  conversationBy: string | null;
  conversationNote: string | null;
  state: SuspensionState;
  vacancy: {
    id: string;
    title: string | null;
    date: string | null;
    startTime: string | null;
  } | null;
  source: {
    infractionId: string;
    status: string | null;
    type: string | null;
    createdAt: string | null;
    contestedAt: string | null;
    justification: string | null;
    contestReason: string | null;
    contest: { status: "OPEN" | "SENT" | "CLOSED"; until: string | null };
  } | null;
  createdByKind: "SYSTEM" | "ADMIN";
  createdByAdminId: string | null;
  liftedAt: string | null;
  liftedBy: string | null;
  liftedReason: string | null;
  liftedNote: string | null;
}

export interface SuspensionList {
  items: SuspensionItem[];
  /** O aviso do jurídico que a API manda junto da lista. */
  legalNotice: string;
}

export async function listSuspensions(
  filter: SuspensionFilter,
): Promise<SuspensionList> {
  const res = await adminsApi.get("/suspensions", { params: { filter } });
  return res.data.data;
}

export async function createSuspension(body: {
  providerGlobalId: string;
  days?: number;
  requiresConversation: boolean;
  reason: string;
}): Promise<unknown> {
  const res = await adminsApi.post("/suspensions", body);
  return res.data.data;
}

export async function liftSuspension(
  id: string,
  body: { reason: SuspensionLiftReason; note?: string },
): Promise<unknown> {
  const res = await adminsApi.post(`/suspensions/${id}/lift`, body);
  return res.data.data;
}

export async function registerSuspensionConversation(
  id: string,
  body: { note?: string },
): Promise<unknown> {
  const res = await adminsApi.post(`/suspensions/${id}/conversation`, body);
  return res.data.data;
}

/**
 * "Manter a ocorrência" (contestação negada): a rota de sempre das infrações com `RESOLVED`.
 * Com a regra ligada, o freelancer recebe o aviso "Mantivemos a ocorrência" (P-G4).
 */
export async function keepInfraction(
  infractionId: string,
  note: string,
): Promise<unknown> {
  const res = await adminsApi.post(`/infractions/${infractionId}/resolve`, {
    decision: "RESOLVED",
    note,
  });
  return res.data.data;
}

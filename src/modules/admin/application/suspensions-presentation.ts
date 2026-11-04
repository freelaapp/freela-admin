import { apiErrorOf } from "../infrastructure/api-error";
import type {
  SuspensionItem,
  SuspensionLiftReason,
  SuspensionReasonKey,
  SuspensionState,
} from "../infrastructure/suspensions-api";

/**
 * Textos da página "Suspensões" (fluxo v2, fatia G; designer, lote 2 §5.5). Puro (sem React).
 */

const SP_TZ = "America/Sao_Paulo";
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** A chave da API está desligada: a rota respondeu 404 `FEATURE_DISABLED`. */
export function isPenaltyLadderDisabled(error: unknown): boolean {
  const e = apiErrorOf(error);
  return e.status === 404 && e.code === "FEATURE_DISABLED";
}

export const DISABLED_TEXT = "As consequências novas ainda não estão ligadas.";
export const EMPTY_TEXT = "Ninguém está sem poder se candidatar agora.";
export const ERROR_TEXT = "Não foi possível carregar as suspensões. Tente de novo.";

function parts(iso: string, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  const weekday =
    WEEKDAYS[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"))] ?? "";
  return { weekday, day: get("day"), month: get("month"), hour: get("hour"), minute: get("minute") };
}

/** "sáb 14/11" (instante, em Brasília). */
export function dayLabel(iso: string): string {
  const p = parts(iso, SP_TZ);
  return `${p.weekday} ${p.day}/${p.month}`;
}

/** "10/11" (instante, em Brasília). */
export function shortDate(iso: string): string {
  const p = parts(iso, SP_TZ);
  return `${p.day}/${p.month}`;
}

/** "ter 10/11 às 18h" (prazo, em Brasília). */
export function deadlineLabel(iso: string): string {
  const p = parts(iso, SP_TZ);
  const hour = p.minute === "00" ? `${Number(p.hour)}h` : `${Number(p.hour)}h${p.minute}`;
  return `${p.weekday} ${p.day}/${p.month} às ${hour}`;
}

const REASON_LABEL: Record<SuspensionReasonKey, string> = {
  LATE_WITHDRAWAL_REPEAT: "2ª desistência em cima da hora em 30 dias",
  LATE_WITHDRAWAL_FIRST_SHIFT: "Desistência em cima da hora no 1º turno",
  NO_SHOW: "Falta sem aviso",
  NO_SHOW_FIRST_SHIFT: "Falta sem aviso no 1º turno",
  NO_SHOW_REPEAT: "2ª falta sem aviso em 60 dias",
  MANUAL: "Suspensão pelo suporte",
};

export function reasonLabel(item: Pick<SuspensionItem, "reasonKey">): string {
  return REASON_LABEL[item.reasonKey];
}

/** "Volta em": a data, "Depois da conversa" ou os dois. */
export function returnLabel(
  item: Pick<SuspensionItem, "endsAt" | "requiresConversation">,
): string {
  if (!item.endsAt) return "Depois da conversa";
  return item.requiresConversation
    ? `${dayLabel(item.endsAt)}, depois da conversa`
    : dayLabel(item.endsAt);
}

/** "Conversa": Pendente · Feita em 10/11 · — (não exigida). */
export function conversationLabel(
  item: Pick<SuspensionItem, "requiresConversation" | "conversationAt">,
): string {
  if (!item.requiresConversation) return "—";
  return item.conversationAt ? `Feita em ${shortDate(item.conversationAt)}` : "Pendente";
}

const STATE_LABEL: Record<SuspensionState, string> = {
  DATED: "Sem poder se candidatar",
  DATED_AND_CONVERSATION: "Sem poder se candidatar",
  CONVERSATION_ONLY: "Esperando a conversa",
  ENDED: "Cumprida",
  LIFTED: "Levantada",
};

export function stateLabel(item: Pick<SuspensionItem, "state">): string {
  return STATE_LABEL[item.state];
}

/** "Origem (ocorrência)": a vaga e a situação da contestação. */
export function originLabel(item: Pick<SuspensionItem, "vacancy" | "source" | "manualReason">): string {
  if (!item.source) return item.manualReason ? `Suporte: ${item.manualReason}` : "Suporte";
  const vacancy = item.vacancy?.title
    ? `${item.vacancy.title}${item.vacancy.startTime ? `, ${dayLabel(item.vacancy.startTime)}` : ""}`
    : "Vaga";
  if (item.source.status === "ANNULLED") return `${vacancy} · ocorrência anulada`;
  if (item.source.contest.status === "SENT") return `${vacancy} · contestada`;
  if (item.source.contest.status === "OPEN" && item.source.contest.until) {
    return `${vacancy} · pode contestar até ${deadlineLabel(item.source.contest.until)}`;
  }
  return vacancy;
}

const CONTEST_REASON_LABEL: Record<string, string> = {
  EMERGENCY: "Emergência",
  MESSAGE_NOT_RECEIVED: "A mensagem não chegou",
  OTHER: "Outro motivo",
};

export function contestReasonLabel(reason: string | null): string | null {
  return reason ? (CONTEST_REASON_LABEL[reason] ?? reason) : null;
}

/** Valendo agora (dá para levantar e registrar a conversa). */
export function isActive(item: Pick<SuspensionItem, "state">): boolean {
  return item.state === "DATED" || item.state === "DATED_AND_CONVERSATION" || item.state === "CONVERSATION_ONLY";
}

export function canRegisterConversation(
  item: Pick<SuspensionItem, "state" | "requiresConversation" | "conversationAt">,
): boolean {
  return isActive(item) && item.requiresConversation && !item.conversationAt;
}

/** Contestação aberta esperando o suporte: dá para manter a ocorrência (P-G4). */
export function canKeepOccurrence(item: Pick<SuspensionItem, "state" | "source">): boolean {
  return isActive(item) && item.source?.status === "CONTESTED";
}

export const LIFT_REASON_OPTIONS: Array<{ value: SuspensionLiftReason; label: string }> = [
  { value: "CONTEST_ACCEPTED", label: "Contestação aceita" },
  { value: "SYSTEM_ERROR", label: "Erro do sistema" },
  { value: "OTHER", label: "Outro" },
];

/** O que cada motivo faz (texto do diálogo). */
export function liftReasonHint(reason: SuspensionLiftReason, hasSource: boolean): string {
  if (reason === "CONTEST_ACCEPTED" && hasSource) {
    return "A ocorrência é anulada: os pontos voltam e o freelancer recebe \"Sua contestação foi aceita\".";
  }
  if (reason === "OTHER") return "Escreva o motivo. O freelancer recebe \"Você já pode se candidatar de novo\".";
  return "Só a suspensão sai. O freelancer recebe \"Você já pode se candidatar de novo\".";
}

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import type { VacancyReservesView } from "./admin-api";

/**
 * Rodada de seleção da vaga (fluxo de vagas v2, fatia E, piloto; designer, lote 2 §5.6). Só
 * leitura, com a permissão de Vagas (`JOBS`).
 *
 * Com a chave da API desligada (`SELECTION_V2_ENABLED`), a lista de empresas vazia ou a empresa
 * fora do piloto (sem rodada), a rota responde 404 `FEATURE_DISABLED`: o modal não mostra a seção.
 */
const adminApi = createAuthedClient("/v1/bars-restaurants/admin");

export type SelectionStage =
  | "em_selecao"
  | "aguardando_contratante"
  | "contratante_escolheu"
  | "sem_disponiveis"
  | "encerrada";

export type SelectionClosedReason =
  | "ACCEPTED_IN_ROUND"
  | "ACCEPTED_OUTSIDE"
  | "NO_ONE_AVAILABLE"
  | "VACANCY_CANCELLED"
  | "VACANCY_GONE"
  /** Lote 3: a empresa mudou o horário da vaga no meio da rodada. */
  | "SCHEDULE_CHANGED"
  /** Lote 3: o "Parar tudo" do runbook (SQL à mão, sem aviso). */
  | "STOPPED"
  /** Pré-seleção curada: ninguém se candidatou até o fim da janela. */
  | "NO_CANDIDATES"
  /** Pré-seleção curada: o admin liberou a lista antes da rodada. */
  | "LIST_RELEASED";

export type SelectionSituation =
  | "ASKED"
  | "AVAILABLE"
  | "NOT_AVAILABLE"
  | "NO_RESPONSE"
  | "SENT_TO_CONTRACTOR"
  | "DECLINED_BY_CONTRACTOR"
  | "WORKING"
  | "RESERVE"
  | "WAITLIST"
  | "LEFT_WAITLIST"
  | "RELEASED"
  | "CANDIDACY_GONE"
  /** Lote 3: saiu da fila de suplentes desta vaga. */
  | "LEFT_RESERVES"
  /** Lote 3: foi suplente e não é mais (a empresa tirou, foi chamado e não pôde, a lista acabou). */
  | "RESERVE_ENDED"
  /** Lote 3: ia trabalhar e a empresa respondeu "Não chegou" (fatia F1). */
  | "NOT_ARRIVED";

export type SelectionRankReason =
  | "LOW_PRIORITY"
  | "WORKED_HERE"
  | "DISTANCE_BAND"
  | "SCORE"
  | "APPLIED_FIRST";

export interface AdminSelectionRound {
  id: string;
  stage: SelectionStage;
  phase: "ASKING" | "OPTIONS_SENT" | "CLOSED";
  band: string;
  preselectionSize: number;
  windowClosedAt: string;
  availabilityDeadlineAt: string;
  optionsSentAt: string | null;
  contractorDeadlineAt: string | null;
  otherNamesUsed: number;
  otherNamesMax: number;
  closedAt: string | null;
  closedReason: SelectionClosedReason | null;
  closedByKind: "SYSTEM" | "CONTRACTOR" | "ADMIN" | null;
  waitlistBuiltAt: string | null;
  waitlistEndedAt: string | null;
  /** 05/11 noite: o que abriu a rodada. Ausente na API de antes. */
  openTrigger?: CompanyViewOpenTrigger | null;
  /** Quem apertou o "Selecionar agora" (só quando `openTrigger = ADMIN_HURRY`). */
  openedBy?: { id: string; name: string | null; email: string | null } | null;
  openNote?: string | null;
  /** O prazo de resposta desta rodada, em minutos (o escolhido no "Selecionar agora"). */
  availabilityMinutes?: number | null;
}

export interface AdminSelectionPerson {
  candidacyId: string;
  /** Ordem da rodada (1 = melhor colocado; os lotes de "outros nomes" continuam a numeração). */
  position: number;
  /** 1 = a janela; 2 e 3 = "Quero outros nomes". */
  batch: number;
  name: string;
  rankReason: SelectionRankReason | null;
  workedHereCount: number;
  situation: SelectionSituation;
  reservePosition: number | null;
  waitlistPosition: number | null;
  answer: "AVAILABLE" | "NOT_AVAILABLE" | null;
  askedAt: string;
  answerDeadlineAt: string;
  answeredAt: string | null;
  answeredVia: "WHATSAPP" | "PAGE" | "SITE" | null;
}

export type CompanyViewMode = "FULL" | "HIDDEN" | "OPTIONS_FIRST" | "OPTIONS_ONLY";

export type CompanyViewReason =
  | "DISABLED"
  | "NOT_ELIGIBLE"
  | "LEGACY_ROUND"
  | "ROUND_CLOSED"
  | "NO_ONE_CONFIRMED"
  | "NO_CANDIDATES"
  | "LATE"
  | "ROUND_DID_NOT_OPEN"
  | "FEWER_CONFIRMED"
  | "NONE_LEFT"
  | "OTHER_NAMES_DONE"
  | "ADMIN";

export type CompanyViewOpenTrigger =
  | "WINDOW_ENDED"
  | "CANDIDATES_REACHED"
  | "CONTRACTOR_HURRY"
  | "NO_CANDIDATES"
  | "LIST_RELEASED"
  /** 05/11 noite: o suporte apertou o "Selecionar agora". */
  | "ADMIN_HURRY";

/**
 * "A empresa vê" (pré-seleção curada): o mesmo objeto do `selection/status` da empresa, mais quem
 * liberou a lista, a nota e o gatilho que abriu as opções.
 */
export interface AdminCompanyView {
  mode: CompanyViewMode;
  curated: boolean;
  stage: "RECEIVING" | "ASKING" | null;
  /** A hora prometida à empresa (ISO). */
  optionsBy: string | null;
  reason: CompanyViewReason | null;
  releasedAt: string | null;
  applicants: number | null;
  asked: number | null;
  options: number;
  listReleasedByKind: "SYSTEM" | "CONTRACTOR" | "ADMIN" | null;
  listReleaseNote: string | null;
  openTrigger: CompanyViewOpenTrigger | null;
}

export type HurryMinutes = 10 | 20 | 45;

export type HurryReason =
  | "ALREADY_STARTED"
  | "ROUND_CLOSED"
  | "ALREADY_CHOSEN"
  | "NOT_ELIGIBLE"
  | "QUIET_HOURS"
  | "NO_CANDIDATES"
  | "NO_TIME_LEFT"
  | "LATER_THAN_PROMISED";

export type HurryOptionReason = "QUIET_HOURS" | "WINDOW_GONE" | "NO_TIME_LEFT" | "LATER_THAN_PROMISED";

export interface AdminHurryOption {
  minutes: HurryMinutes;
  allowed: boolean;
  reason: HurryOptionReason | null;
  /** Até quando os freelancers respondem (ISO). */
  answersBy: string;
  /** A hora que a empresa passa a ver (ISO). */
  optionsBy: string;
}

/**
 * O bloco `hurry` do GET da rodada (05/11 noite): o servidor decide e manda pronto, inclusive o
 * motivo escrito (`message`). A tela não refaz regra nenhuma.
 */
export interface AdminSelectionHurry {
  available: boolean;
  reason: HurryReason | null;
  message: string | null;
  pendingCount: number;
  askUpTo: number;
  normalMinutes: number | null;
  contractorMinutes: number | null;
  currentOptionsBy: string | null;
  /** A rodada nasceria com a lista escondida. */
  listHidden: boolean;
  startTime: string | null;
  /** Vazio quando o botão nem aparece. */
  options: AdminHurryOption[];
  computedAt: string;
}

export interface AdminSelectionRoundView {
  /** `null` = a vaga não teve rodada de seleção. */
  round: AdminSelectionRound | null;
  people: AdminSelectionPerson[];
  /** `null` (ou ausente, API de antes) = sem a chave ou vaga que nunca escondeu a lista. */
  companyView?: AdminCompanyView | null;
  /** Ausente (API de antes) ou `null`: o "Selecionar agora" não aparece. */
  hurry?: AdminSelectionHurry | null;
}

export interface AdminHurryResult extends AdminSelectionRoundView {
  hurried: { roundId: string; asked: number; answersBy: string; optionsBy: string };
}

/** O motivo do "Selecionar agora": opcional, até 500 caracteres. */
export const HURRY_NOTE_MAX = 500;

export async function getVacancySelectionRound(
  vacancyId: string,
): Promise<AdminSelectionRoundView> {
  const res = await adminApi.get(`/vacancies/${vacancyId}/selection-round`);
  return res.data.data;
}

/** O motivo da liberação: obrigatório, até 500 caracteres. */
export const RELEASE_NOTE_MAX = 500;

/**
 * "Liberar a lista agora": a empresa passa a ver os candidatos. Responde o mesmo `GET` da rodada.
 * Erros: 400 `RELEASE_NOTE_REQUIRED` / `RELEASE_NOTE_TOO_LONG`, 404 `VACANCY_NOT_FOUND`,
 * 409 `SELECTION_LIST_ALREADY_VISIBLE`.
 */
export async function releaseVacancyCandidateList(
  vacancyId: string,
  note: string,
): Promise<AdminSelectionRoundView> {
  const res = await adminApi.post(`/vacancies/${vacancyId}/selection-round/release-list`, { note });
  return res.data.data;
}

/**
 * "Selecionar agora": fecha a janela e abre a rodada na hora. Erros: 400
 * `SELECTION_HURRY_MINUTES_INVALID` / `SELECTION_HURRY_NOTE_TOO_LONG`, 404, 409
 * `SELECTION_ALREADY_STARTED` / `SELECTION_ROUND_CLOSED` / `VACANCY_SLOT_FILLED`, 422
 * `SELECTION_HURRY_*`. As mensagens dos 409 e 422 já terminam em "Nada mudou.".
 */
export async function hurryVacancySelection(
  vacancyId: string,
  body: { minutes: HurryMinutes; note?: string },
): Promise<AdminHurryResult> {
  const note = body.note?.trim();
  const res = await adminApi.post(`/vacancies/${vacancyId}/selection-round/hurry`, {
    minutes: body.minutes,
    ...(note ? { note } : {}),
  });
  return res.data.data;
}

export type ChooseBilling = "INVOICE" | "AWAITING_PAYMENT" | "ALREADY_PAID";

export interface AdminChooseResult {
  candidacy: { candidacyId: string; vacancyId: string; providerId: string; status: string };
  reserves: VacancyReservesView | null;
  billing: ChooseBilling;
}

/**
 * "Escolher titular e suplentes": os suplentes são gravados antes do aceite do titular. Em erro
 * nada é aprovado (a lista de suplentes volta a ser a de antes).
 */
export async function chooseVacancyTeam(
  vacancyId: string,
  body: { principalCandidacyId: string; reserveCandidacyIds: string[] },
): Promise<AdminChooseResult> {
  const res = await adminApi.post(`/vacancies/${vacancyId}/choose`, body);
  return res.data.data;
}

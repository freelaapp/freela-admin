import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Rodada de seleção da vaga (fluxo de vagas v2, fatia E, piloto; designer, lote 2 §5.6). Só
 * leitura, com a permissão de Vagas (`JOBS`).
 *
 * Com a chave da API desligada (`SELECTION_V2_ENABLED`) ou a lista de empresas vazia, a rota
 * responde 404 `FEATURE_DISABLED`: o modal da vaga não mostra a seção.
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
  | "VACANCY_GONE";

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
  | "CANDIDACY_GONE";

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

export interface AdminSelectionRoundView {
  /** `null` = a vaga não teve rodada de seleção. */
  round: AdminSelectionRound | null;
  people: AdminSelectionPerson[];
}

export async function getVacancySelectionRound(
  vacancyId: string,
): Promise<AdminSelectionRoundView> {
  const res = await adminApi.get(`/vacancies/${vacancyId}/selection-round`);
  return res.data.data;
}

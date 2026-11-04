import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

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
  | "STOPPED";

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

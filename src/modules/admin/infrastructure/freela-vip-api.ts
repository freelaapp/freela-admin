import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Cliente do funil Freela VIP (rotas `/v1/vip/admin/...`). Toda resposta vem
 * envelopada em `{ data }`; erros em `{ error: { code, message } }`.
 * Espelha os DTOs/serviços do backend (`src/common/freela-vip`).
 */
const api = createAuthedClient("/v1/vip/admin");

export type VipStatus =
  | "PRE_SELECTED" | "INVITED" | "SELF_ENROLLED" | "FORM_STARTED" | "FORM_SUBMITTED"
  | "SCORED" | "WAITLIST" | "INTERVIEW_SCHEDULED" | "REFERENCES_OK" | "BACKGROUND_PENDING"
  | "BACKGROUND_OK" | "TEST_SERVICE" | "VIP_PROVISIONAL" | "VIP_ACTIVE" | "VIP_SUSPENDED"
  | "REJECTED" | "WITHDREW";

export type VipSource = "BASE" | "LINK";

/**
 * Conta de um critério da nota — espelha `VipScoreCriterion` do api
 * (`vip-score.ts`). `max` é aceito só por compatibilidade: o api manda
 * `weight` (o teto do critério), não `max`.
 */
export interface VipScoreCriterion {
  weight: number;
  fraction?: number | null;
  points: number;
  detail?: string | null;
  max?: number | null;
}

export interface VipCycle {
  id: string;
  targetContractorUserId: string;
  targetOrganizationId: string | null;
  name: string;
  cities: string[];
  roles: string[];
  targetVacancies: number;
  invitesPerVacancy: number;
  radiusKm: number;
  backgroundJustification: string | null;
  startsAt: string | null;
  endsAt: string | null;
  linkOpen: boolean;
  enrollmentCap: number | null;
  active: boolean;
  createdByAdminId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVipCycleInput {
  targetContractorUserId: string;
  targetOrganizationId?: string;
  name: string;
  cities: string[];
  roles: string[];
  targetVacancies: number;
  invitesPerVacancy?: number;
  radiusKm?: number;
  backgroundJustification?: string;
  startsAt?: string;
  endsAt?: string;
  linkOpen?: boolean;
  enrollmentCap?: number;
}

export type UpdateVipCycleInput = Partial<Omit<CreateVipCycleInput, "targetContractorUserId">> & {
  active?: boolean;
};

export interface VipPreselectedCandidate {
  providerGlobalId: string;
  userId: string | null;
  city: string | null;
  distanceKm: number | null;
  roles: string[];
  completenessScore: number;
  hasCleanHistory: boolean;
  totalCompletedServices: number;
  recentCompletedServices: number;
  hasWhatsappPhone: boolean;
  hasAvatar: boolean;
}

export interface VipPreselectedResult {
  candidates: VipPreselectedCandidate[];
  total: number;
  invitesBudget: number;
}

export interface VipInviteResult {
  invited: { providerGlobalId: string; applicationId: string }[];
  skipped: { providerGlobalId: string; reason: string }[];
}

export interface VipKanbanCard {
  id: string;
  status: VipStatus;
  providerGlobalId: string | null;
  source: VipSource;
  /** `null` para quem só tem VIP_READONLY. */
  displayName: string | null;
  city: string | null;
  role: string | null;
  totalScore: number | null;
  alertsCount: number;
  createdAt: string;
}

export interface VipKanbanColumn {
  stage: VipStatus;
  title: string;
  count: number;
  cards: VipKanbanCard[];
}

export interface VipKanbanBoard {
  columns: VipKanbanColumn[];
  totalActive: number;
  rejectedCount: number;
  withdrewCount: number;
}

export interface VipIndicatorMetric {
  atual: number | null;
  meta: number | null;
}

export interface VipIndicators {
  cycleId: string;
  taxaResposta: VipIndicatorMetric;
  taxaAprovacaoNota: VipIndicatorMetric;
  taxaAprovacaoFinal: VipIndicatorMetric;
  tempoMedioProcessoDias: VipIndicatorMetric;
  vipsPorVaga: VipIndicatorMetric;
  permanencia: VipIndicatorMetric;
  melhorCanal: string | null;
  distribuicaoAprovacaoFinal: { porSource: Record<string, number>; porOrigin: Record<string, number> };
  contagemPorStatus: Record<string, number>;
  totais: {
    convitesBase: number;
    formulariosEnviados: number;
    aprovadosNota: number;
    vipsAtivos: number;
    targetVacancies: number;
  };
}

export interface VipEvent {
  id: string;
  action: string;
  statusBefore: VipStatus | null;
  statusAfter: VipStatus | null;
  actorAdminId: string | null;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface VipApplicationDetail {
  id: string;
  cycleId: string;
  providerGlobalId: string | null;
  source: VipSource;
  origin: string | null;
  status: VipStatus;
  /** `null` em leitura. */
  cpf: string | null;
  formBasics: {
    fullName: string | null;
    birthdate: string | null;
    neighborhood: string | null;
    city: string | null;
    mainRole: string | null;
    secondaryRoles: string[];
  } | null;
  formAvailability: Record<string, unknown> | null;
  consentDataUse: { acceptedAt: string; version: string } | null;
  consentReferences: { acceptedAt: string; version: string } | null;
  score: {
    totalScore: number | null;
    curriculumScore: number | null;
    appScore: number | null;
    breakdown: Record<string, VipScoreCriterion> | null;
  };
  alerts: unknown[];
  /** `null` em leitura; `backgroundResult` só com VIP_BACKGROUND. */
  decision: {
    rejectionReason: string | null;
    approvedByAdminId: string | null;
    backgroundResult: "APT" | "NOT_APT" | "IN_ANALYSIS" | null;
  } | null;
  experiences: {
    id: string; company: string; role: string; type: string;
    startMonth: string | null; endMonth: string | null; isCurrent: boolean;
    highVolume: boolean; confirmed: "YES" | "NO" | "PENDING";
  }[];
  references: {
    id: string; company: string | null; name: string | null; phone: string | null;
    result: "CONFIRMED" | "NOT_CONFIRMED" | "NO_CONTACT" | "PENDING";
  }[];
  answers: { questionId: string; selectedOptionIndex: number; pointsAwarded: number | null }[];
  documents: { id: string; type: string; fileName: string; uploadedAt: string }[];
  history: VipEvent[];
  timestamps: Record<string, string | null>;
}

export interface VipBackgroundDocument {
  id: string;
  type: string;
  fileName: string;
  validationCode: string | null;
  uploadedAt: string;
}

export interface VipQuestion {
  id: string;
  role: string;
  text: string;
  type: "SINGLE_CHOICE";
  options: string[];
  pointsPerOption: number[];
  required: boolean;
  order: number;
  active: boolean;
}

export interface VipQuestionInput {
  role: string;
  text: string;
  options: string[];
  pointsPerOption: number[];
  required?: boolean;
  order?: number;
  active?: boolean;
}

export interface VipScoringConfig {
  weights: Record<string, number>;
  bands: Record<string, unknown>;
  cutoffs: { high: number; waitlist: number };
}

export interface VipScoringConfigRecord {
  config: VipScoringConfig;
  persisted: boolean;
  version: number | null;
  updatedByAdminId: string | null;
  updatedAt: string | null;
}

export interface VipMessageTemplate {
  moment: string;
  text: string;
  isOverride: boolean;
  version: number | null;
  updatedByAdminId: string | null;
  updatedAt: string | null;
  variables: string[];
}

export interface VipActiveVip {
  id: string;
  cycleId: string;
  cycleName: string;
  providerGlobalId: string | null;
  displayName: string | null;
  city: string | null;
  mainRole: string | null;
  status: VipStatus;
  decidedAt: string | null;
}

// ─── Ciclos ──────────────────────────────────────────────────────────────────
export async function getVipCycles(active?: boolean): Promise<VipCycle[]> {
  const res = await api.get("/cycles", { params: active === undefined ? {} : { active } });
  return res.data.data ?? [];
}
export async function getVipCycle(id: string): Promise<VipCycle> {
  const res = await api.get(`/cycles/${id}`);
  return res.data.data;
}
export async function createVipCycle(input: CreateVipCycleInput): Promise<VipCycle> {
  const res = await api.post("/cycles", input);
  return res.data.data;
}
export async function updateVipCycle(id: string, input: UpdateVipCycleInput): Promise<VipCycle> {
  const res = await api.patch(`/cycles/${id}`, input);
  return res.data.data;
}
export async function getVipPreselected(id: string, limit: number): Promise<VipPreselectedResult> {
  const res = await api.get(`/cycles/${id}/pre-selected`, { params: { limit } });
  return res.data.data;
}
export async function sendVipInvites(id: string, candidateIds: string[]): Promise<VipInviteResult> {
  const res = await api.post(`/cycles/${id}/invites`, { candidateIds });
  return res.data.data;
}
export async function getVipKanban(id: string): Promise<VipKanbanBoard> {
  const res = await api.get(`/cycles/${id}/kanban`);
  return res.data.data;
}
export async function getVipIndicators(id: string): Promise<VipIndicators> {
  const res = await api.get(`/cycles/${id}/indicators`);
  return res.data.data;
}

// ─── Candidaturas ────────────────────────────────────────────────────────────
export async function getVipApplication(id: string): Promise<VipApplicationDetail> {
  const res = await api.get(`/applications/${id}`);
  return res.data.data;
}
export async function moveVipStage(id: string, stage: VipStatus): Promise<VipKanbanCard> {
  const res = await api.patch(`/applications/${id}/stage`, { stage });
  return res.data.data;
}
export async function confirmVipReference(
  id: string, refId: string, result: "CONFIRMED" | "NOT_CONFIRMED" | "NO_CONTACT",
): Promise<void> {
  await api.patch(`/applications/${id}/references/${refId}`, { result });
}
export async function confirmVipExperience(id: string, expId: string, confirmed: "YES" | "NO"): Promise<void> {
  await api.patch(`/applications/${id}/experiences/${expId}`, { confirmed });
}
export async function decideVipApplication(
  id: string, action: "approve" | "reject", rejectionReason?: string,
): Promise<{ status: VipStatus; promotedToVip: boolean }> {
  const res = await api.patch(`/applications/${id}/status`, { action, rejectionReason });
  return res.data.data;
}
export async function rescoreVipApplication(id: string): Promise<{ totalScore: number | null; status: VipStatus }> {
  const res = await api.post(`/applications/${id}/rescore`);
  return res.data.data;
}
export async function openVipBackground(id: string): Promise<void> {
  await api.patch(`/applications/${id}/background/open`);
}
export async function getVipBackgroundDocuments(id: string): Promise<VipBackgroundDocument[]> {
  const res = await api.get(`/applications/${id}/background/documents`);
  return res.data.data ?? [];
}
export async function getVipDocumentDownload(id: string, docId: string): Promise<{ url: string; expiresInSeconds: number }> {
  const res = await api.get(`/applications/${id}/documents/${docId}/download`);
  return res.data.data;
}
export async function decideVipBackground(id: string, result: "APT" | "NOT_APT"): Promise<{ status: VipStatus }> {
  const res = await api.patch(`/applications/${id}/background`, { result });
  return res.data.data;
}

// ─── Config ──────────────────────────────────────────────────────────────────
export async function getVipQuestions(role?: string): Promise<VipQuestion[]> {
  const res = await api.get("/questions", { params: role ? { role } : {} });
  return res.data.data ?? [];
}
export async function createVipQuestion(input: VipQuestionInput): Promise<VipQuestion> {
  const res = await api.post("/questions", input);
  return res.data.data;
}
export async function updateVipQuestion(id: string, input: Partial<VipQuestionInput>): Promise<VipQuestion> {
  const res = await api.patch(`/questions/${id}`, input);
  return res.data.data;
}
export async function deleteVipQuestion(id: string): Promise<void> {
  await api.delete(`/questions/${id}`);
}
export async function getVipScoringConfig(): Promise<VipScoringConfigRecord> {
  const res = await api.get("/scoring-config");
  return res.data.data;
}
export async function putVipScoringConfig(config: VipScoringConfig): Promise<VipScoringConfigRecord> {
  const res = await api.put("/scoring-config", config);
  return res.data.data;
}
export async function getVipMessageTemplates(): Promise<VipMessageTemplate[]> {
  const res = await api.get("/message-templates");
  return res.data.data ?? [];
}
export async function putVipMessageTemplate(moment: string, text: string): Promise<VipMessageTemplate> {
  const res = await api.put(`/message-templates/${moment}`, { text });
  return res.data.data;
}

// ─── VIPs ativos por rede ────────────────────────────────────────────────────
export async function getActiveVips(contractorUserId: string, status?: "VIP_ACTIVE" | "VIP_SUSPENDED"): Promise<VipActiveVip[]> {
  const res = await api.get("/vips", { params: { contractorUserId, ...(status ? { status } : {}) } });
  return res.data.data ?? [];
}

// ─── Redes (seletor do painel VIP) ──────────────────────────────────────────
/**
 * A tabela de contratantes é do módulo `bars-restaurants` (não do `vip`) — por
 * isso este cliente usa o prefixo do admin de empresas, igual a `getAdminContractors`
 * em `admin-api.ts`, em vez do `api` (`/v1/vip/admin`) usado no resto deste arquivo.
 */
const barsAdminApi = createAuthedClient("/v1/bars-restaurants/admin");

/** Item do seletor de rede — só os campos que o painel VIP precisa (permissão any-of COMPANIES|VIP_ADMIN|VIP_READONLY|VIP_BACKGROUND). */
export interface VipContractorItem {
  userId: string;
  companyName: string | null;
  contactName: string | null;
  city: string | null;
  uf: string | null;
}

export async function getVipContractors(): Promise<VipContractorItem[]> {
  const res = await barsAdminApi.get("/contractors/summary");
  return res.data.data ?? [];
}

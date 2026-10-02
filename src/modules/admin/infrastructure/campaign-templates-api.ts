import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import type {
  AudienceFilters,
  CampaignAudience,
  CampaignRates,
  CampaignStatus,
  CampaignTemplateRef,
} from "./referrals-api";

// Templates de campanha automática (recorrente) vivem sob /v1/admins, como
// indicações e campanhas por planilha.
const adminsRootApi = createAuthedClient("/v1/admins");

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type CampaignScheduleKind = "WEEKLY" | "DATED";
export type CampaignChannel = "PUSH" | "WHATSAPP";

/**
 * Audiência dos templates: reusa as 4 audiências de `referrals-api.ts` e
 * soma as 2 novas ("todos os contratantes" / "contratantes ativos") que só
 * existem aqui. Não editar `CampaignAudience` em referrals-api.ts por isso.
 */
export type CampaignTemplateAudience =
  | CampaignAudience
  | "CONTRACTORS_ALL"
  | "CONTRACTORS_ACTIVE";

export interface UpsertCampaignTemplatePayload {
  name: string;
  scheduleKind: CampaignScheduleKind;
  /** 0=domingo..6=sábado. Só com scheduleKind WEEKLY. */
  weekdays?: number[];
  /** 0-23. Só com scheduleKind WEEKLY. */
  sendHour?: number;
  /** 1-12, só com scheduleKind DATED. */
  targetMonth?: number;
  /** 1-31, só com scheduleKind DATED. */
  targetDay?: number;
  targetYear?: number;
  /** 0-60. Só com scheduleKind DATED. */
  leadDays?: number;
  audience: CampaignTemplateAudience;
  audienceFilters?: AudienceFilters;
  channels: CampaignChannel[];
  /** Modelo de marketing do canal WhatsApp (spec 2026-10-01 campanhas §7). */
  marketingTemplateId?: string | null;
  /** Resposta automática a quem responder (até 500). */
  replyText?: string | null;
  /** E-mail que recebe o aviso de resposta. */
  replyAlertEmail?: string | null;
  pushTitle?: string;
  pushBody?: string;
  imageKey?: string;
  deepLink?: string;
  maxPerRun?: number;
}

/** Última execução na lista das automáticas (spec 2026-10-01 parte 2 §7). Push: só `sent`. */
export interface CampaignLastRun {
  id: string;
  /** Dia da execução, `YYYY-MM-DD`. */
  occurrence: string | null;
  channel: CampaignChannel | null;
  status: CampaignStatus;
  startedAt: string | null;
  sent: number;
  delivered: number | null;
  read: number | null;
  clicked: number | null;
}

/** Uma execução no histórico, com os números da §6 (push: só `recipients`/`sent`). */
export interface CampaignRun {
  id: string;
  name: string;
  occurrence: string | null;
  channel: CampaignChannel | null;
  status: CampaignStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  recipients: number;
  sent: number;
  delivered: number | null;
  read: number | null;
  clicked: number | null;
  clicks: number | null;
  optedOut: number | null;
  replied: number | null;
  billable: number | null;
  costBrl: number | null;
  signups: number | null;
  publishedVacancy: number | null;
  hired: number | null;
  rates: CampaignRates | null;
}

export interface CampaignRunsPage {
  total: number;
  page: number;
  pageSize: number;
  items: CampaignRun[];
}

export interface CampaignTemplate extends UpsertCampaignTemplatePayload {
  id: string;
  enabled: boolean;
  lastRunFor: string | null;
  lastRunAt: string | null;
  createdAt: string;
  marketingTemplate?: CampaignTemplateRef | null;
  /** WhatsApp ligado sem modelo aprovado: a execução manda só o push. */
  whatsappNeedsTemplate?: boolean;
  /** "Escolha um modelo aprovado para voltar a mandar WhatsApp" ou `null`. */
  whatsappNotice?: string | null;
  /** Última execução (a de WhatsApp; sem ela, a de push). */
  lastRun?: CampaignLastRun | null;
}

export interface CampaignTemplateImageUpload {
  /** objectKey S3 a persistir no template (`imageKey`). */
  key: string;
  /** URL presignada para preview imediato no formulário. */
  url: string;
}

// ─── Funções ────────────────────────────────────────────────────────────────

export interface CampaignTemplatesList {
  data: CampaignTemplate[];
  /** Despachante (`ACTIVATION_CAMPAIGNS_ENABLED`) e agendador da automática (`CAMPAIGN_TEMPLATES_ENABLED`). */
  meta: { schedulerEnabled: boolean; templatesSchedulerEnabled: boolean };
}

export async function listCampaignTemplates(): Promise<CampaignTemplatesList> {
  const res = await adminsRootApi.get("/campaign-templates");
  return {
    data: res.data.data,
    meta: {
      schedulerEnabled: Boolean(res.data.meta?.schedulerEnabled),
      templatesSchedulerEnabled: Boolean(res.data.meta?.templatesSchedulerEnabled),
    },
  };
}

export async function getCampaignTemplate(id: string): Promise<CampaignTemplate> {
  const res = await adminsRootApi.get(`/campaign-templates/${id}`);
  return res.data.data;
}

export async function createCampaignTemplate(
  payload: UpsertCampaignTemplatePayload,
): Promise<CampaignTemplate> {
  const res = await adminsRootApi.post("/campaign-templates", payload);
  return res.data.data;
}

export async function updateCampaignTemplate(
  id: string,
  payload: UpsertCampaignTemplatePayload,
): Promise<CampaignTemplate> {
  const res = await adminsRootApi.put(`/campaign-templates/${id}`, payload);
  return res.data.data;
}

export async function setCampaignTemplateEnabled(
  id: string,
  enabled: boolean,
): Promise<CampaignTemplate> {
  const res = await adminsRootApi.patch(`/campaign-templates/${id}/enabled`, { enabled });
  return res.data.data;
}

/**
 * Upload multipart da imagem do push (campo `file`). Mesma técnica de
 * `ads-api.ts#uploadAdImage`: header `multipart/form-data` SEM boundary faz o
 * axios delegar ao browser a serialização do FormData (que define o boundary
 * correto) em vez de tentar serializar como JSON.
 */
export async function uploadCampaignTemplateImage(
  file: File,
): Promise<CampaignTemplateImageUpload> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await adminsRootApi.post("/campaign-templates/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}

/** Histórico das execuções de uma automática, mais nova primeiro (até 50 por página). */
export async function listCampaignTemplateRuns(
  id: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<CampaignRunsPage> {
  const res = await adminsRootApi.get(`/campaign-templates/${id}/runs`, { params });
  return res.data.data;
}

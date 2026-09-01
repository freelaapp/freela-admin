import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import type { AudienceFilters, CampaignAudience } from "./referrals-api";

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
  whatsappTemplate?: string;
  pushTitle?: string;
  pushBody?: string;
  imageKey?: string;
  deepLink?: string;
  messagesPerHour?: number;
  dailyCap?: number;
  windowStartHour?: number;
  windowEndHour?: number;
  weekdaysOnly?: boolean;
  maxPerRun?: number;
}

export interface CampaignTemplate extends UpsertCampaignTemplatePayload {
  id: string;
  enabled: boolean;
  lastRunFor: string | null;
  lastRunAt: string | null;
  createdAt: string;
}

export interface CampaignTemplateImageUpload {
  /** objectKey S3 a persistir no template (`imageKey`). */
  key: string;
  /** URL presignada para preview imediato no formulário. */
  url: string;
}

// ─── Funções ────────────────────────────────────────────────────────────────

export async function listCampaignTemplates(): Promise<CampaignTemplate[]> {
  const res = await adminsRootApi.get("/campaign-templates");
  return res.data.data;
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

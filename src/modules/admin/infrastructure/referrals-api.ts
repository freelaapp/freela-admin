import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

// Indicações e campanhas vivem sob /v1/admins (shared kernel), como parcerias.
const adminsRootApi = createAuthedClient("/v1/admins");

// ── Indicações ───────────────────────────────────────────────────────────────

export type ReferralStatus = "REGISTERED" | "QUALIFIED" | "REJECTED";
export type RewardStatus = "PENDING" | "APPROVED" | "PAID" | "CANCELLED";
export type RewardType = "REFERRAL" | "MONTHLY_BONUS";

interface UserRef {
  id: string;
  phone: string | null;
  email: string | null;
  profile: { name: string | null } | null;
}

export interface ReferralItem {
  id: string;
  status: ReferralStatus;
  rejectionReason: string | null;
  createdAt: string;
  qualifiedAt: string | null;
  qualifyingModule: string | null;
  code: { code: string } | null;
  referrer: UserRef | null;
  /**
   * Quem indicou: freelancer, contratante, os dois (a mesma pessoa pode ter
   * cadastro dos dois lados) ou sem cadastro conhecido. Opcional durante a
   * janela de deploy da API.
   */
  referrerKind?: "FREELANCER" | "CONTRATANTE" | "AMBOS" | "DESCONHECIDO";
  referred: UserRef | null;
  reward: {
    id: string;
    status: RewardStatus;
    amountInCents: number;
    pixKey: string | null;
    paidAt: string | null;
  } | null;
}

export interface RewardItem {
  id: string;
  type: RewardType;
  amountInCents: number;
  status: RewardStatus;
  competenceMonth: string | null;
  pixKey: string | null;
  pixKeyType: string | null;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  paymentProof: string | null;
  cancelReason: string | null;
  provider: UserRef | null;
  referral: {
    id: string;
    qualifiedAt: string | null;
    referred: { profile: { name: string | null } | null } | null;
  } | null;
}

export interface ReferralSummary {
  referrals: Record<ReferralStatus, number>;
  rewards: Record<RewardStatus, { count: number; amountInCents: number }>;
  /** Prometido e ainda não pago — o passivo do programa. */
  outstandingInCents: number;
}

export interface Paginated<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface ReferralListFilter {
  status?: ReferralStatus;
  rewardStatus?: RewardStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getReferralSummary(): Promise<ReferralSummary> {
  const res = await adminsRootApi.get("/referrals/summary");
  return res.data.data;
}

export async function getReferrals(filter: ReferralListFilter): Promise<Paginated<ReferralItem>> {
  const res = await adminsRootApi.get("/referrals", { params: filter });
  return res.data.data;
}

export async function getReferralRewards(
  filter: ReferralListFilter,
): Promise<Paginated<RewardItem>> {
  const res = await adminsRootApi.get("/referrals/rewards", { params: filter });
  return res.data.data;
}

export async function approveReward(id: string): Promise<RewardItem> {
  const res = await adminsRootApi.patch(`/referrals/rewards/${id}/approve`);
  return res.data.data;
}

export async function payReward(
  id: string,
  payload: { paymentProof: string; pixKey?: string },
): Promise<RewardItem> {
  const res = await adminsRootApi.patch(`/referrals/rewards/${id}/pay`, payload);
  return res.data.data;
}

export async function cancelReward(id: string, reason: string): Promise<RewardItem> {
  const res = await adminsRootApi.patch(`/referrals/rewards/${id}/cancel`, { reason });
  return res.data.data;
}

// ── Campanhas de ativação ────────────────────────────────────────────────────

export type CampaignStatus = "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type RecipientStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

/** Admin que criou/disparou/marcou — vem da API desde a campanha por planilha. */
export interface AdminRef {
  id: string;
  name: string | null;
}

/** Audiência de lista externa: contatos vêm de uma planilha, não da base. */
export const EXTERNAL_LIST_AUDIENCE = "EXTERNAL_LIST" as const;

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  audience: string;
  audienceNote: string | null;
  /** Nome do arquivo subido (só campanha por planilha). */
  listFileName?: string | null;
  createdBy?: AdminRef | null;
  startedBy?: AdminRef | null;
  messagesPerHour: number;
  dailyCap: number;
  windowStartHour: number;
  windowEndHour: number;
  weekdaysOnly: boolean;
  nextSendAt: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  _count?: { recipients: number };
  /**
   * Resultado do disparo, por status. Vem na LISTA desde 11/08/2026 — antes só
   * existia no detalhe, e a lista dizia quantos entraram na campanha sem dizer
   * quantos de fato saíram.
   */
  stats?: Record<RecipientStatus, number>;
}

/** Contagens do detalhe. `contacted`/`registered` só existem desde a lista externa. */
export interface CampaignCounts {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  contacted: number;
  registered: number;
}

export interface CampaignDetail {
  campaign: Campaign;
  stats: Record<RecipientStatus, number>;
  byChannel: { WHATSAPP: number; EMAIL: number };
  total: number;
  /** Quantas por dia e quantos dias úteis a fila pendente ainda leva. */
  estimate: { perDay: number; days: number };
  /** Contagens já consolidadas (API nova). Ausente em versão antiga da API. */
  counts?: Partial<CampaignCounts>;
  contacted?: number;
  registered?: number;
  /** A API resolve os admins no detalhe (raiz), não dentro de `campaign`. */
  createdBy?: AdminRef | null;
  startedBy?: AdminRef | null;
}

/**
 * Contagens do detalhe independentemente da versão da API: usa `counts` se
 * veio, senão compõe a partir de `stats` (que sempre existiu).
 */
export function getCampaignCounts(detail: CampaignDetail): CampaignCounts {
  const c = detail.counts ?? {};
  return {
    total: c.total ?? detail.total ?? 0,
    sent: c.sent ?? detail.stats?.SENT ?? 0,
    failed: c.failed ?? detail.stats?.FAILED ?? 0,
    pending: c.pending ?? detail.stats?.PENDING ?? 0,
    contacted: c.contacted ?? detail.contacted ?? 0,
    registered: c.registered ?? detail.registered ?? 0,
  };
}

export interface RecipientRegistration {
  userId: string;
  registeredAt: string;
  /** Tipo de conta que a pessoa criou (freelancer/contratante…). */
  role: string;
  /** Cadastrou DEPOIS do disparo — o que a campanha pode reivindicar. */
  afterCampaign?: boolean;
}

export interface CampaignRecipient {
  id: string;
  channel: "WHATSAPP" | "EMAIL";
  destination: string;
  displayName: string | null;
  city: string | null;
  status: RecipientStatus;
  attempts: number;
  sentAt: string | null;
  failureReason: string | null;
  // ── Campos da lista externa / acompanhamento (API desde 26/08/2026) ──
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Operador marcou "conseguiu contato". */
  contactedAt?: string | null;
  contactedBy?: AdminRef | null;
  contactNote?: string | null;
  /** A pessoa criou conta depois do disparo. */
  registered?: RecipientRegistration | null;
}

export interface RecipientListParams {
  status?: RecipientStatus;
  contacted?: boolean;
  registered?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
}

/** Linha da planilha como vai para a API (sem número da linha). */
export interface ExternalContact {
  name?: string;
  phone?: string;
  email?: string;
}

export interface ExternalListPreview {
  total?: number;
  valid: number;
  /** `row` é a posição (1-based) no array `contacts` enviado. */
  invalid: Array<{ row: number; reason: string }>;
  duplicates: number;
  /** Quantos já têm conta — ou, se a API mandar, quais (posições 1-based). */
  alreadyRegistered: number | Array<{ row: number }>;
  byChannel: { whatsapp: number; email: number };
}

/** Normaliza `alreadyRegistered` (número OU lista) para contagem + posições. */
export function readAlreadyRegistered(preview: ExternalListPreview): {
  count: number;
  rows: number[] | null;
} {
  const value = preview.alreadyRegistered;
  if (Array.isArray(value)) return { count: value.length, rows: value.map((r) => r.row) };
  return { count: value ?? 0, rows: null };
}

/**
 * Recorte por cima da audiência. Lista vazia = SEM recorte, nunca "ninguém".
 * `modules` é também o filtro de tipo de conta do contratante: Empresa é
 * `bars-restaurants` e Em Casa é `home-services`.
 */
export interface AudienceFilters {
  cities?: string[];
  ufs?: string[];
  modules?: Array<"bars-restaurants" | "home-services">;
  /** "Jundiaí e 100 km em volta". Centro calculado pela própria base. */
  radius?: { city: string; km: number };
}

export type CampaignAudience =
  | "CONTRACTORS_NEVER_PUBLISHED"
  | "CONTRACTORS_DORMANT_90D"
  | "PROVIDERS_NEVER_APPLIED"
  | "PROVIDERS_DORMANT_90D";

export interface AudienceOption {
  city: string;
  uf: string | null;
  total: number;
}

export interface CreateCampaignPayload {
  name: string;
  audience: CampaignAudience | typeof EXTERNAL_LIST_AUDIENCE;
  audienceFilters?: AudienceFilters;
  audienceNote?: string;
  /** Só com `audience: EXTERNAL_LIST`. */
  contacts?: ExternalContact[];
  listFileName?: string;
  /**
   * Texto do WhatsApp com `{{nome}}`/`{{primeiro_nome}}`. Até 3 variantes
   * separadas por uma linha `---`; rodam alternadas. Obrigatório na lista
   * externa (o padrão da API fala de "seu cadastro").
   */
  whatsappTemplate?: string;
  messagesPerHour?: number;
  dailyCap?: number;
  windowStartHour?: number;
  windowEndHour?: number;
  weekdaysOnly?: boolean;
}

export async function getCampaigns(): Promise<{
  data: Campaign[];
  schedulerEnabled: boolean;
}> {
  const res = await adminsRootApi.get("/activation-campaigns");
  return { data: res.data.data, schedulerEnabled: Boolean(res.data.meta?.schedulerEnabled) };
}

export async function getCampaign(id: string): Promise<CampaignDetail> {
  const res = await adminsRootApi.get(`/activation-campaigns/${id}`);
  return res.data.data;
}

export async function getCampaignRecipients(
  id: string,
  params: RecipientListParams,
): Promise<Paginated<CampaignRecipient>> {
  // Só manda o que está preenchido: a API recusa chave desconhecida/vazia
  // (ValidationPipe com forbidNonWhitelisted), e `q=""` não é filtro.
  const query: Record<string, string | number | boolean> = {};
  if (params.status) query.status = params.status;
  if (params.contacted !== undefined) query.contacted = params.contacted;
  if (params.registered !== undefined) query.registered = params.registered;
  if (params.q?.trim()) query.q = params.q.trim();
  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;
  const res = await adminsRootApi.get(`/activation-campaigns/${id}/recipients`, {
    params: query,
  });
  return res.data.data;
}

/** Valida a planilha na API sem criar nada. Máx. 5.000 contatos. */
export async function previewExternalList(
  contacts: ExternalContact[],
): Promise<ExternalListPreview> {
  const res = await adminsRootApi.post("/activation-campaigns/external-list/preview", {
    contacts,
  });
  return res.data.data;
}

/** Marca/desmarca "conseguiu contato" com nota; a API grava quem marcou. */
export async function setRecipientContact(
  campaignId: string,
  recipientId: string,
  payload: { contacted: boolean; note?: string },
): Promise<CampaignRecipient> {
  const res = await adminsRootApi.patch(
    `/activation-campaigns/${campaignId}/recipients/${recipientId}/contact`,
    payload,
  );
  return res.data.data;
}

/** CSV pronto da API (todas as linhas, sem paginação), com os mesmos filtros da tela. */
export async function exportCampaignRecipientsCsv(
  campaignId: string,
  filters: Omit<RecipientListParams, "page" | "pageSize"> = {},
): Promise<Blob> {
  const query: Record<string, string | boolean> = {};
  if (filters.status) query.status = filters.status;
  if (filters.contacted !== undefined) query.contacted = filters.contacted;
  if (filters.registered !== undefined) query.registered = filters.registered;
  if (filters.q?.trim()) query.q = filters.q.trim();
  const res = await adminsRootApi.get(`/activation-campaigns/${campaignId}/recipients/export`, {
    params: query,
    responseType: "blob",
  });
  return res.data as Blob;
}

export async function previewCampaignMessages(payload: {
  name?: string;
  city?: string;
}): Promise<string[]> {
  const res = await adminsRootApi.post("/activation-campaigns/preview", payload);
  return res.data.data;
}

/** Cidades que existem nesta audiência, com o tamanho de cada uma. */
export async function getAudienceOptions(
  audience: CampaignAudience,
): Promise<{ total: number; cities: AudienceOption[] }> {
  const res = await adminsRootApi.get("/activation-campaigns/audience-options", {
    params: { audience },
  });
  return res.data.data;
}

/** Conta a audiência com os filtros escolhidos, sem criar nada. */
export async function previewCampaignAudience(payload: {
  audience: CampaignAudience;
  filters?: AudienceFilters;
}): Promise<{
  total: number;
  byChannel: { WHATSAPP: number; EMAIL: number };
  /** Só com raio: quantos ficaram de fora por não ter coordenada. */
  semCoordenada?: number;
}> {
  const res = await adminsRootApi.post("/activation-campaigns/audience-preview", payload);
  return res.data.data;
}

export async function createCampaign(payload: CreateCampaignPayload): Promise<CampaignDetail> {
  const res = await adminsRootApi.post("/activation-campaigns", payload);
  return res.data.data;
}

export async function setCampaignState(
  id: string,
  action: "start" | "pause" | "cancel",
): Promise<CampaignDetail> {
  const res = await adminsRootApi.patch(`/activation-campaigns/${id}/${action}`);
  return res.data.data;
}

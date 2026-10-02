import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import type { MarketingTemplateStatus } from "./marketing-templates-api";

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
  /** Instantes ISO com fuso (ver `toInstantRange`) — a API trata como `Date`. */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/** Perfil que o indicado tem HOJE, não o que declarou no cadastro. */
export type ReferredProfile = "empresa" | "casa" | "freelancer" | "semPerfil";

/**
 * Funil do Indique e Ganhe no período (dias de Brasília, fim inclusivo). Cada
 * etapa conta pela data do próprio evento.
 */
export interface ReferralFunnelMetrics {
  period: { from: string | null; to: string | null };
  /** Aberturas da tela "Indique e ganhe" — medidas desde 28/09/2026. */
  pageViews: { total: number; uniqueUsers: number; byPlatform: { web: number; app: number } };
  /** Aberturas do link de cadastro com código — medidas desde 28/09/2026. */
  linkOpens: { total: number; uniqueCodes: number };
  /** Códigos criados; cada código é um link. */
  codesGenerated: number;
  signups: {
    total: number;
    byStatus: Record<ReferralStatus, number>;
    byProfile: Record<ReferredProfile, number>;
  };
  vacancies: {
    total: number;
    contractors: number;
    byModule: { "bars-restaurants": number; "home-services": number };
  };
}

export async function getReferralSummary(): Promise<ReferralSummary> {
  const res = await adminsRootApi.get("/referrals/summary");
  return res.data.data;
}

export async function getReferralMetrics(range: {
  from?: string;
  to?: string;
}): Promise<ReferralFunnelMetrics> {
  // Só manda o lado preenchido: `from=""` a API recusa (formato YYYY-MM-DD).
  const params: Record<string, string> = {};
  if (range.from) params.from = range.from;
  if (range.to) params.to = range.to;
  const res = await adminsRootApi.get("/referrals/metrics", { params });
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

/** SCHEDULED: avulsa agendada (spec 2026-10-01 campanhas parte 1 §6). */
export type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED";

/** Modelo de marketing ligado à campanha (lista e detalhe). */
export interface CampaignTemplateRef {
  id: string;
  name: string;
  status: MarketingTemplateStatus;
  metaName: string;
}

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
  // ── Campanhas pela Meta (API desde a parte 1, 2026-10) ──
  marketingTemplateId?: string | null;
  marketingTemplate?: CampaignTemplateRef | null;
  /** Instante ISO do disparo agendado (só SCHEDULED). */
  scheduledStartAt?: string | null;
  /** Resposta automática a quem responder a campanha. */
  replyText?: string | null;
  /** Quem recebe o e-mail "Resposta à campanha …". */
  replyAlertEmail?: string | null;
  /** Planilha: "essas pessoas aceitaram receber". */
  optInConfirmed?: boolean;
  /** Ex.: "A Meta pausou o modelo: …", "Qualidade do número caiu na Meta". */
  pausedReason?: string | null;
  // ── Resultados (API da parte 2, 2026-10) ──
  /** `null` = campanha sem rastreio (push, e-mail, Z-API antigo): a tela mostra "—". */
  delivered?: number | null;
  read?: number | null;
  clicked?: number | null;
  costBrl?: number | null;
}

/** Contagens do detalhe. `contacted`/`registered` só existem desde a lista externa. */
export interface CampaignCounts {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  contacted: number;
  registered: number;
  /** Dos cadastrados, quantos criaram conta DEPOIS do disparo. */
  registeredAfterCampaign?: number;
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
    registeredAfterCampaign: c.registeredAfterCampaign,
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
  // ── Campanhas pela Meta ──
  /** `wamid` do envio. */
  providerMessageId?: string | null;
  /** Tocou em "Não quero receber" nesta campanha. */
  optedOutAt?: string | null;
  /** Última resposta de texto livre (até 1000). */
  replyText?: string | null;
  repliedAt?: string | null;
  /** Quando a resposta automática foi mandada (uma vez por campanha). */
  autoRepliedAt?: string | null;
  // ── Entrega, leitura e clique (API da parte 2) ──
  deliveredAt?: string | null;
  readAt?: string | null;
  firstClickedAt?: string | null;
  clickCount?: number;
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

export type RegisteredRole = "provider" | "contractor" | "both" | "unknown";

export interface AlreadyRegisteredRow {
  /** Posição (1-based) no array `contacts` enviado. */
  row: number;
  userId: string;
  role: RegisteredRole;
}

export interface ExternalListPreview {
  total?: number;
  valid: number;
  /** `row` é a posição (1-based) no array `contacts` enviado. */
  invalid: Array<{ row: number; reason: string }>;
  duplicates: number;
  /** Quantos já têm conta (contagem). */
  alreadyRegistered: number;
  /** Quais já têm conta — API desde 26/08/2026. */
  alreadyRegisteredRows?: AlreadyRegisteredRow[];
  byChannel: { whatsapp: number; email: number };
  /** Telefones que já saíram (marketing ou SAIR) — ficam de fora. */
  excludedByOptOut?: number;
}

/**
 * Contagem + linhas de quem já tem conta. `rows` é `null` quando a API não
 * mandou a lista (versão antiga): aí dá para avisar, mas não para pular.
 */
export function readAlreadyRegistered(preview: ExternalListPreview): {
  count: number;
  rows: AlreadyRegisteredRow[] | null;
} {
  const rows = preview.alreadyRegisteredRows;
  if (Array.isArray(rows)) return { count: preview.alreadyRegistered ?? rows.length, rows };
  return { count: preview.alreadyRegistered ?? 0, rows: null };
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
  /** Só contratante: não publicou vaga nos últimos N dias (1..365), inclusive quem nunca publicou. */
  noVacancyForDays?: number;
  /** Só contratante: tira quem já contratou (pagamento concluído). */
  excludeHired?: boolean;
  /** Tira quem recebeu campanha por WhatsApp nos últimos N dias (1..90). */
  excludeContactedWithinDays?: number;
}

export type CampaignAudience =
  | "CONTRACTORS_NEVER_PUBLISHED"
  | "CONTRACTORS_DORMANT_90D"
  | "PROVIDERS_NEVER_APPLIED"
  | "PROVIDERS_DORMANT_90D";

/**
 * Recortes da base que a campanha avulsa cria. "Todos os contratantes" e "Contratantes
 * ativos" entraram com a Meta (spec 2026-10-01 parte 1 §6); antes eram só da automática.
 */
export type BaseAudience = CampaignAudience | "CONTRACTORS_ALL" | "CONTRACTORS_ACTIVE";

export interface AudienceOption {
  city: string;
  uf: string | null;
  total: number;
}

export interface CreateCampaignPayload {
  name: string;
  audience: BaseAudience | typeof EXTERNAL_LIST_AUDIENCE;
  audienceFilters?: AudienceFilters;
  audienceNote?: string;
  /** Só com `audience: EXTERNAL_LIST`. */
  contacts?: ExternalContact[];
  listFileName?: string;
  /** Modelo de marketing da biblioteca (obrigatório; spec 2026-10-01 campanhas §5.1). */
  marketingTemplateId: string;
  /** Resposta automática a quem responder (até 500); `null` = não responder. */
  replyText?: string | null;
  /** E-mail que recebe o aviso de resposta (a tela manda o do admin logado por padrão). */
  replyAlertEmail?: string | null;
  /** Planilha: obrigatório `true` (400 `OPT_IN_REQUIRED`). */
  optInConfirmed?: boolean;
  /** Ritmo (spec §5.3): base 60/h·200/dia; planilha 20/h·100/dia; 9–18; dias úteis. */
  messagesPerHour?: number;
  dailyCap?: number;
  windowStartHour?: number;
  windowEndHour?: number;
  weekdaysOnly?: boolean;
  /**
   * Lista externa: descarta na criação quem já tem conta (telefone E.164 ou
   * e-mail em `users`). Se sobrar ninguém, a API responde `EMPTY_AUDIENCE`.
   */
  skipRegistered?: boolean;
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
  audience: BaseAudience,
): Promise<{ total: number; cities: AudienceOption[] }> {
  const res = await adminsRootApi.get("/activation-campaigns/audience-options", {
    params: { audience },
  });
  return res.data.data;
}

/** O que cada refinamento tirou da contagem (spec 2026-10-01 parte 2 §3). */
export interface AudienceExclusions {
  noVacancy: number;
  hired: number;
  recentlyContacted: number;
  /** Mesmo número de `excludedByOptOut`. */
  optedOut: number;
}

export interface AudienceCountPreview {
  total: number;
  byChannel: { WHATSAPP: number; EMAIL: number };
  /** Só com raio: quantos ficaram de fora por não ter coordenada. */
  semCoordenada?: number;
  /** Já pediram para não receber (marketing ou SAIR) — ficam de fora. */
  excludedByOptOut?: number;
  /** Excluídos por motivo, na ordem da spec (API da parte 2). */
  excluded?: AudienceExclusions;
  /** Contatos repetidos que a deduplicação de telefone tirou (API da parte 2). */
  duplicates?: number;
  /** Filtros normalizados que a API aplicou. */
  filters?: AudienceFilters | null;
}

/** Conta a audiência com os filtros escolhidos, sem criar nada. */
export async function previewCampaignAudience(payload: {
  audience: BaseAudience;
  filters?: AudienceFilters;
}): Promise<AudienceCountPreview> {
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

/** Rascunho: troca modelo, resposta e ritmo (o público já foi congelado na criação). */
export interface UpdateCampaignPayload {
  name?: string;
  marketingTemplateId?: string;
  /** `null` limpa. */
  replyText?: string | null;
  replyAlertEmail?: string | null;
  messagesPerHour?: number;
  dailyCap?: number;
  windowStartHour?: number;
  windowEndHour?: number;
  weekdaysOnly?: boolean;
}

/** Resumo do passo 4 (só destinatários pendentes). */
export interface CampaignEstimate {
  recipients: { whatsapp: number; email: number; total: number };
  excludedByOptOut: number;
  whatsappToSend: number;
  pricePerMessageBrl: number;
  estimatedCostBrl: number;
  estimate: { perDay: number; days: number };
}

/** Só DRAFT (409 `CAMPAIGN_NOT_EDITABLE`). */
export async function updateCampaign(
  id: string,
  payload: UpdateCampaignPayload,
): Promise<CampaignDetail> {
  const res = await adminsRootApi.patch(`/activation-campaigns/${id}`, payload);
  return res.data.data;
}

/**
 * DRAFT → SCHEDULED. `startAt` é ISO 8601 COM fuso (ex.: `2026-10-02T10:00:00-03:00`),
 * no futuro e até 60 dias. Exige modelo aprovado (409 `MARKETING_TEMPLATE_NOT_APPROVED`).
 */
export async function scheduleCampaign(id: string, startAt: string): Promise<CampaignDetail> {
  const res = await adminsRootApi.patch(`/activation-campaigns/${id}/schedule`, { startAt });
  return res.data.data;
}

/** SCHEDULED → DRAFT. */
export async function unscheduleCampaign(id: string): Promise<CampaignDetail> {
  const res = await adminsRootApi.patch(`/activation-campaigns/${id}/unschedule`);
  return res.data.data;
}

export async function getCampaignEstimate(id: string): Promise<CampaignEstimate> {
  const res = await adminsRootApi.get(`/activation-campaigns/${id}/estimate`);
  return res.data.data;
}

/** Taxas da campanha (frações 0..1; 0 quando a base é 0). */
export interface CampaignRates {
  /** entregues / enviados */
  deliveredRate: number;
  /** lidos / entregues */
  readRate: number;
  /** clicaram / entregues */
  clickRate: number;
}

export interface NotReceivedReason {
  reason: string;
  count: number;
}

/** `GET /activation-campaigns/:id/results` (spec 2026-10-01 parte 2 §6). */
export interface CampaignResults {
  recipients: number;
  sent: number;
  delivered: number;
  read: number;
  /** Pessoas que clicaram. */
  clicked: number;
  /** Total de cliques. */
  clicks: number;
  optedOut: number;
  replied: number;
  billable: number;
  costBrl: number;
  signups: number;
  /** Publicaram vaga em até 14 dias depois do envio. */
  publishedVacancy: number;
  /** Contrataram (pagamento concluído) em até 30 dias depois do envio. */
  hired: number;
  rates: CampaignRates;
  notReceived: NotReceivedReason[];
  /** O modelo conta cliques; `false` = "clicaram" não se aplica. */
  clickTracking: boolean;
  /** `false` = não foi enviada pela API oficial: entrega, leitura, cliques e custo não existem. */
  deliveryTracked?: boolean;
  pricePerMessageBrl: number;
}

export async function getCampaignResults(id: string): Promise<CampaignResults> {
  const res = await adminsRootApi.get(`/activation-campaigns/${id}/results`);
  return res.data.data;
}

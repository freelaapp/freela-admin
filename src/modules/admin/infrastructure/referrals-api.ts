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

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  audience: string;
  audienceNote: string | null;
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

export interface CampaignDetail {
  campaign: Campaign;
  stats: Record<RecipientStatus, number>;
  byChannel: { WHATSAPP: number; EMAIL: number };
  total: number;
  /** Quantas por dia e quantos dias úteis a fila pendente ainda leva. */
  estimate: { perDay: number; days: number };
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
}

export interface CreateCampaignPayload {
  name: string;
  audience: "CONTRACTORS_NEVER_PUBLISHED" | "CONTRACTORS_DORMANT_90D";
  audienceNote?: string;
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
  params: { status?: RecipientStatus; page?: number; pageSize?: number },
): Promise<Paginated<CampaignRecipient>> {
  const res = await adminsRootApi.get(`/activation-campaigns/${id}/recipients`, { params });
  return res.data.data;
}

export async function previewCampaignMessages(payload: {
  name?: string;
  city?: string;
}): Promise<string[]> {
  const res = await adminsRootApi.post("/activation-campaigns/preview", payload);
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

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const subscriptionsApi = createAuthedClient("/v1/admin/subscriptions");

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type PlanCode = "FREE" | "BASIC" | "VIP" | "ENTERPRISE";
export type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED";

export interface SubscriptionRow {
  storeId: string;
  organizationId: string;
  organizationName: string;
  contractorUserId: string;
  name: string;
  cnpj: string | null;
  taxRegime: string | null;
  planCode: PlanCode;
  status: SubscriptionStatus | null;
  scheduledPlanCode: PlanCode | null;
  currentPeriodEnd: string | null;
  courtesyUntil: string | null;
  underCourtesy: boolean;
}

export interface SubscriptionListResult {
  rows: SubscriptionRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface QuotaBalance {
  periodYm: string;
  limit: number;
  used: number;
  remaining: number;
  planCode: string;
  extraJobPriceInCents: number;
}

export type AdminActionType =
  | "PLAN_ASSIGNED"
  | "PLAN_SCHEDULED"
  | "COURTESY_GRANTED"
  | "COURTESY_REVOKED"
  | "PERIOD_EXTENDED"
  | "QUOTA_ADJUSTED"
  | "CANCELLED";

export interface AdminAction {
  id: string;
  action: AdminActionType;
  fromPlanCode: PlanCode | null;
  toPlanCode: PlanCode | null;
  courtesyUntil: string | null;
  quotaDelta: number | null;
  note: string | null;
  adminEmail: string | null;
  createdAt: string;
}

export interface QuotaLedgerEntry {
  id: string;
  periodYm: string;
  delta: number;
  reason: string;
  note: string | null;
  createdAt: string;
}

export interface SubscriptionDetail {
  store: {
    id: string;
    name: string;
    cnpj: string | null;
    taxRegime: string | null;
    contractorUserId: string;
    organizationName: string;
  };
  plan: { code: PlanCode; name: string; monthlyPriceInCents: number; serviceFeePercent: number };
  subscription: {
    status: SubscriptionStatus;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    scheduledPlanCode: PlanCode | null;
    courtesyUntil: string | null;
    courtesyReason: string | null;
  } | null;
  quota: QuotaBalance | null;
  quotaLedger: QuotaLedgerEntry[];
  adminActions: AdminAction[];
}

export interface ListParams {
  planCode?: PlanCode;
  search?: string;
  page?: number;
  pageSize?: number;
}

// ─── Funções ────────────────────────────────────────────────────────────────

export async function listSubscriptions(params: ListParams): Promise<SubscriptionListResult> {
  const res = await subscriptionsApi.get("", { params });
  return { rows: res.data.data, meta: res.data.meta };
}

export async function getSubscription(storeId: string): Promise<SubscriptionDetail> {
  const res = await subscriptionsApi.get(`/${storeId}`);
  return res.data.data;
}

export async function assignPlan(storeId: string, planCode: PlanCode) {
  const res = await subscriptionsApi.patch(`/${storeId}`, { planCode, immediate: true });
  return res.data.data;
}

export async function grantCourtesy(
  storeId: string,
  input: { planCode?: PlanCode; months: number; note?: string },
) {
  const res = await subscriptionsApi.post(`/${storeId}/courtesy`, input);
  return res.data.data;
}

export async function revokeCourtesy(storeId: string, note?: string) {
  const res = await subscriptionsApi.delete(`/${storeId}/courtesy`, { data: { note } });
  return res.data.data;
}

export async function extendPeriod(storeId: string, input: { days: number; note?: string }) {
  const res = await subscriptionsApi.post(`/${storeId}/extend`, input);
  return res.data.data;
}

export async function adjustQuota(storeId: string, input: { delta: number; note?: string }) {
  const res = await subscriptionsApi.post(`/${storeId}/quota`, input);
  return res.data.data;
}

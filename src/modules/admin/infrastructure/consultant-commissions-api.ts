import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import type {
  CommissionDashboard,
  CommissionRule,
  CommissionRulePayload,
  CommissionRulesResponse,
  PayoutPreview,
  RegisterPayoutPayload,
  StatementEntryItem,
  StatementFilter,
  StatementPage,
  StatementPayoutItem,
} from "@/lib/commissions/types";

const adminsRootApi = createAuthedClient("/v1/admins");
const base = (id: string) => `/consultants/${encodeURIComponent(id)}`;

export async function getCommissionsSummary(): Promise<{ openInCents: number; paidThisMonthInCents: number }> {
  const res = await adminsRootApi.get("/consultants/commissions/summary");
  return res.data.data;
}

export async function getCommissionRules(id: string): Promise<CommissionRulesResponse> {
  const res = await adminsRootApi.get(`${base(id)}/commission-rules`);
  return res.data.data;
}

export async function createCommissionRule(id: string, payload: CommissionRulePayload): Promise<CommissionRule> {
  const res = await adminsRootApi.post(`${base(id)}/commission-rules`, payload);
  return res.data.data;
}

export async function getCommissionDashboard(
  id: string,
  range: { from?: string; to?: string },
): Promise<CommissionDashboard> {
  const res = await adminsRootApi.get(`${base(id)}/commission-dashboard`, { params: range });
  return res.data.data;
}

export async function getCommissionStatement(id: string, filter: StatementFilter): Promise<StatementPage> {
  const res = await adminsRootApi.get(`${base(id)}/commission-statement`, { params: filter });
  return res.data.data;
}

export async function addCommissionAdjustment(
  id: string,
  payload: { amountInCents: number; reason: string },
): Promise<StatementEntryItem> {
  const res = await adminsRootApi.post(`${base(id)}/commission-adjustments`, payload);
  return res.data.data;
}

export async function previewCommissionPayout(id: string, periodEnd: string): Promise<PayoutPreview> {
  const res = await adminsRootApi.get(`${base(id)}/commission-payouts/preview`, { params: { periodEnd } });
  return res.data.data;
}

export async function registerCommissionPayout(id: string, payload: RegisterPayoutPayload): Promise<StatementPayoutItem> {
  const res = await adminsRootApi.post(`${base(id)}/commission-payouts`, payload);
  return res.data.data;
}

export async function reverseCommissionPayout(id: string, payoutId: string, reason: string): Promise<StatementPayoutItem> {
  const res = await adminsRootApi.post(
    `${base(id)}/commission-payouts/${encodeURIComponent(payoutId)}/reverse`,
    { reason },
  );
  return res.data.data;
}

/** Espelho das respostas da API de comissão de consultores (spec 2026-10-05). */
export type CommissionMode = "OFF" | "PERCENT_OF_FEE" | "FIXED_PER_HIRE" | "FIXED_PER_CLIENT";

export interface CommissionRule {
  id: string;
  mode: CommissionMode;
  percent: number | null;
  amountInCents: number | null;
  durationMonths: number | null;
  includeEmpresa: boolean;
  includeCasa: boolean;
  effectiveFrom: string;
  createdByAdminId: string | null;
  description: string;
}

export interface CommissionRulesResponse {
  current: CommissionRule | null;
  history: CommissionRule[];
}

export interface CommissionRulePayload {
  mode: CommissionMode;
  percent: number | null;
  amountInCents: number | null;
  durationMonths: number | null;
  includeEmpresa: boolean;
  includeCasa: boolean;
}

export interface CommissionDashboard {
  period: { from: string | null; to: string | null };
  rule: { description: string; mode: CommissionMode } | null;
  registrations: { total: number; empresa: number; casa: number; freelancer: number; semPerfil: number };
  vacancies: { published: number; hires: number; completed: number };
  commission: { generatedInCents: number; paidInCents: number; openInCents: number };
  clients: Array<{
    userId: string;
    name: string | null;
    companyName: string | null;
    vacancies: number;
    completed: number;
    commissionInCents: number;
  }>;
}

export type StatementStatus = "OPEN" | "PAID";

export interface StatementEntryItem {
  type: "ENTRY";
  id: string;
  kind: "COMMISSION" | "ADJUSTMENT";
  occurredAt: string;
  amountInCents: number;
  clientName: string | null;
  companyName: string | null;
  module: string | null;
  vacancyTitle: string | null;
  vacancyDate: string | null;
  baseFeeInCents: number | null;
  ruleDescription: string | null;
  reason: string | null;
  status: StatementStatus;
  payoutId: string | null;
  paidAt: string | null;
}

export interface StatementPayoutItem {
  type: "PAYOUT";
  id: string;
  paidAt: string;
  amountInCents: number;
  paymentProof: string;
  periodEnd: string;
  reversedAt: string | null;
  reversalReason: string | null;
  entriesCount: number;
}

export type StatementItem = StatementEntryItem | StatementPayoutItem;

export interface CommissionBalances {
  openInCents: number;
  paidInCents: number;
}

export interface StatementPage {
  items: StatementItem[];
  total: number;
  page: number;
  pageSize: number;
  /** Só no endpoint do admin. */
  balances?: CommissionBalances;
}

export interface StatementFilter {
  from?: string;
  to?: string;
  status?: StatementStatus;
  page?: number;
  pageSize?: number;
}

export interface PayoutPreview {
  periodEnd: string;
  amountInCents: number;
  entries: StatementEntryItem[];
}

export interface RegisterPayoutPayload {
  periodEnd: string;
  paidAt: string;
  paymentProof: string;
  expectedAmountInCents: number;
}

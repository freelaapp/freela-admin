import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import { apiErrorOf } from "./api-error";
import type { BillingMode, DateKey } from "./billing-mode-api";

/**
 * Faturas do faturado no painel (aba Faturas do Financeiro; API #587, API-3e).
 * Todas as rotas sob `/v1/admin/billing` exigem FINANCE (403 sem ela). Toda
 * escrita leva `reason` (>= 5 caracteres; 422 `REASON_REQUIRED`) e fica na trilha
 * `billing_admin_actions` com o admin do token.
 *
 * Os textos já vêm prontos da API (situação, conta e fonte de cada número,
 * rótulos da régua, porquê de cada ação desabilitada): a tela não recalcula.
 */
const billingApi = createAuthedClient("/v1/admin");

// ─── Tipos (espelham a API-3e) ───────────────────────────────────────────────

export type AdminInvoiceSituationCode =
  | "A_VENCER"
  | "VENCE_HOJE"
  | "VENCIDA"
  | "BLOQUEADA"
  | "LIBERADA"
  | "PAGA"
  | "PAGA_MANUAL"
  | "QUITADA"
  | "CANCELADA";

export type InvoiceStatus = "ISSUED" | "PAID" | "SETTLED_BY_CREDIT" | "CANCELLED";

export type DunningStep =
  | "ISSUED"
  | "D_MINUS_1"
  | "D0"
  | "D_PLUS_1"
  | "D_PLUS_2"
  | "D_PLUS_3"
  | "BLOCKED"
  | "PAID"
  | "MANUAL_PAID"
  | "RESEND"
  | "SECOND_COPY"
  | "WAIVED"
  | "DOUBLE_PAYMENT";

export interface AdminInvoiceSituation {
  code: AdminInvoiceSituationCode;
  /** O texto da coluna "Situação" (UX 7.7), pronto. */
  label: string;
  /** Hoje − vencimento, em dias de Brasília; 0 se não venceu ou não está em aberto. */
  overdueDays: number;
  waivedUntil: string | null;
}

/** Resultado por canal: `sent`, `failed:<motivo>`, `skipped:<motivo>`. */
export type ChannelResults = Record<string, string>;

export interface AdminInvoiceListItem {
  id: string;
  /** "FAT-2026-000123". */
  number: string;
  /** O tomador fotografado no fechamento. */
  company: { contractorUserId: string; name: string | null; document: string | null };
  mode: BillingMode;
  modeLabel: string;
  periodStart: DateKey;
  periodEnd: DateKey;
  closedAt: string;
  dueDate: DateKey;
  totalInCents: number;
  /** "R$ 1.248,60". */
  total: string;
  status: InvoiceStatus;
  situation: AdminInvoiceSituation;
  paidAt: string | null;
  paidVia: "PIX" | "MANUAL" | null;
  lastMessage: {
    step: DunningStep;
    label: string;
    at: string;
    by: "SYSTEM" | "ADMIN" | "CONTRACTOR";
    channels: ChannelResults | null;
  } | null;
}

export interface AdminInvoiceList {
  items: AdminInvoiceListItem[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface AdminInvoiceListParams {
  situation?: AdminInvoiceSituationCode;
  mode?: BillingMode;
  contractorUserId?: string;
  /** Nome do tomador ou CNPJ/CPF, com ou sem pontuação. */
  search?: string;
  /** Fechamento de/até (dias de Brasília, inclusive). */
  closedFrom?: DateKey;
  closedTo?: DateKey;
  page?: number;
}

/** Uma linha do relatório: o número, a conta e a fonte. */
export interface InvoiceReportItem {
  lineId: string;
  kind: string;
  serviceDate: DateKey | null;
  title: string;
  /** "R$ 124,81" (créditos com "− "). */
  amount: string;
  amountInCents: number;
  calc: string;
  source: string | null;
  feeCalc?: string | null;
}

export interface InvoiceReport {
  header: {
    title: string;
    number: string;
    mode: string;
    status: string;
    statusCode: InvoiceStatus;
    period: string;
    closed: string;
    due: string;
    closeReason: string | null;
  };
  taker: { name: string | null; document: string | null; address: string | null; email: string | null };
  services: InvoiceReportItem[];
  additionalHours: InvoiceReportItem[];
  adjustments: InvoiceReportItem[];
  credits: InvoiceReportItem[];
  totals: {
    debitsInCents: number;
    creditsInCents: number;
    totalInCents: number;
    carryOverInCents: number;
    total: string;
    calc: string;
  };
  payment: { lines: string[] };
  /** "Em conferência": serviços do período ainda sem presença confirmada. */
  pending: string | null;
  supportLine: string;
  footer: string;
}

export interface AdminInvoiceCharge {
  id: string;
  attempt: number;
  chargeType: string;
  valueInCents: number;
  dueDate: DateKey | null;
  expiresAt: string | null;
  status: string;
  brCode: string | null;
  paymentLinkUrl: string | null;
  createdAt: string;
  paidAt: string | null;
  /** "Sistema", "Empresa" ou o nome do admin. */
  createdBy: string;
}

export interface ActionState {
  enabled: boolean;
  /** Por que está desabilitada (texto pronto). */
  reason: string | null;
}

export interface TakerSnapshot {
  name: string | null;
  document: string | null;
  address: {
    cep: string | null;
    street: string | null;
    number: string | null;
    neighborhood: string | null;
    city: string | null;
    uf: string | null;
  };
  email: string | null;
  phone: string | null;
  capturedAt: string;
}

export interface AdminInvoiceDetail {
  invoice: Omit<AdminInvoiceListItem, "lastMessage"> & {
    closeReason: string | null;
    debitsInCents: number;
    creditsInCents: number;
    carryOverInCents: number;
    paidAmountInCents: number | null;
    dueAt: string;
    blockFrom: string;
    blockWaivedUntil: string | null;
    blockWaiver: { reason: string | null; by: string | null } | null;
    manualPayment: { reason: string | null; by: string | null } | null;
    taker: TakerSnapshot | null;
  };
  situation: AdminInvoiceSituation;
  /** Faixa vermelha: pagamento em dobro para devolver. */
  alerts: Array<{ code: "DOUBLE_PAYMENT"; at: string; text: string; note: string | null }>;
  report: InvoiceReport;
  charges: AdminInvoiceCharge[];
  inReview: { count: number; text: string | null };
  history: Array<{
    step: DunningStep;
    label: string;
    at: string;
    by: string;
    note: string | null;
    channels: ChannelResults | null;
    pending: boolean;
  }>;
  auditTrail: Array<{
    action: string;
    label: string;
    at: string;
    by: string;
    reason: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }>;
  actions: {
    resend: ActionState;
    secondCopy: ActionState;
    markPaid: ActionState & { defaultAmountInCents: number; defaultPaidDate: DateKey };
    waiveBlock: ActionState & { suggestedUntil: DateKey; maxUntil: DateKey };
  };
  links: { pdfRoute: string; contractorWebUrl: string };
}

/** Um número do topo: valor, a conta (`calc`/`meta`) e a fonte (`source`/`help`). */
export interface SummaryCard {
  label: string;
  valueInCents: number;
  count: number;
  calc: string;
  source: string;
  meta: string;
  help: string;
}

export interface BillingSummary {
  period: { preset: string; start: string; end: string; label: string };
  generatedAt: string;
  cards: {
    upcoming: SummaryCard & { nextDueDate: DateKey | null };
    overdue: SummaryCard & { companies: number; oldestDays: number };
    blockedCompanies: SummaryCard & { blockEnabled: boolean };
    received: SummaryCard & {
      pix: { count: number; valueInCents: number };
      manual: { count: number; valueInCents: number };
    };
    unbilled: SummaryCard & { companies: number; lineCount: number };
    advanced: SummaryCard & {
      frontedInCents: number;
      frontedCount: number;
      coveredInCents: number;
      coveredCount: number;
    };
  };
  receivableTotal: { label: string; valueInCents: number; calc: string; source: string };
  doublePayments: {
    count: number;
    text: string | null;
    calc: string;
    source: string;
    latest: Array<{ invoiceId: string; number: string; companyName: string | null; at: string }>;
  };
}

export type SummaryPeriod =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "last_month"
  | "custom";

export type ResendChannel = "push" | "email";

export interface ResendResult {
  copy: string;
  label: string;
  channels: ChannelResults;
}

export interface SecondCopyResult {
  attempt: number;
  brCode: string | null;
  qrCodeImage: string | null;
  paymentLinkUrl: string | null;
  dueDate: DateKey | null;
  status: string;
}

export interface MarkPaidResult {
  invoice: {
    id: string;
    number: string;
    status: InvoiceStatus;
    paidVia: "PIX" | "MANUAL" | null;
    paidAt: string | null;
    paidAmountInCents: number | null;
    totalInCents: number;
  };
  /** O Pix pendente na Woovi: cancelado, nenhum, sem o gateway ligado, ou falhou. */
  pendingCharge: "CANCELLED" | "NONE" | "NO_PROVIDER" | "FAILED";
}

export interface WaiveBlockResult {
  invoice: { id: string; number: string; status: InvoiceStatus; blockWaivedUntil: string | null };
  until: DateKey;
  situation: AdminInvoiceSituation;
}

export interface AdjustmentInput {
  /** DEBIT = cobrança, CREDIT = desconto. */
  direction: "DEBIT" | "CREDIT";
  amountInCents: number;
  reason: string;
  vacancyId?: string | null;
  /** Gerado UMA vez ao abrir o diálogo: clique duplo não lança duas vezes. */
  requestId: string;
}

export interface AdjustmentResult {
  line: { id: string; kind: string; direction: "DEBIT" | "CREDIT"; amountInCents: number };
  /** O mesmo pedido já tinha sido gravado (clique duplo, nova tentativa). */
  replayed: boolean;
}

// ─── Funções ────────────────────────────────────────────────────────────────

const invoicePath = (id: string) => `/billing/invoices/${encodeURIComponent(id)}`;
const contractorPath = (contractorUserId: string) =>
  `/billing/contractors/${encodeURIComponent(contractorUserId)}`;

/** Tira filtro vazio (a API recusa campo inválido e "" não é filtro). */
function compact(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const clean = typeof value === "string" ? value.trim() : value;
    if (clean === "") continue;
    out[key] = clean;
  }
  return out;
}

export async function listAdminInvoices(params: AdminInvoiceListParams = {}): Promise<AdminInvoiceList> {
  const res = await billingApi.get("/billing/invoices", { params: compact({ ...params }) });
  const meta = res.data.meta ?? {};
  return {
    items: res.data.data ?? [],
    page: meta.page ?? 1,
    pageSize: meta.pageSize ?? 20,
    total: meta.total ?? 0,
    hasMore: meta.hasMore ?? false,
  };
}

export async function getAdminInvoice(id: string): Promise<AdminInvoiceDetail> {
  const res = await billingApi.get(invoicePath(id));
  return res.data.data;
}

/** O PDF precisa do token: baixa como blob pelo cliente autenticado. */
export async function downloadAdminInvoicePdf(id: string): Promise<Blob> {
  const res = await billingApi.get(`${invoicePath(id)}/pdf`, { responseType: "blob" });
  return res.data;
}

export async function resendInvoice(
  id: string,
  input: { reason: string; channels?: ResendChannel[] },
): Promise<ResendResult> {
  const res = await billingApi.post(`${invoicePath(id)}/resend`, {
    reason: input.reason.trim(),
    ...(input.channels ? { channels: input.channels } : {}),
  });
  return res.data.data;
}

/** 2ª via do Pix. `null` = a API não devolveu cobrança (sem o gateway, vem 503 antes). */
export async function issueSecondCopy(
  id: string,
  input: { reason: string },
): Promise<SecondCopyResult | null> {
  const res = await billingApi.post(`${invoicePath(id)}/charges`, { reason: input.reason.trim() });
  return res.data.data ?? null;
}

export async function markInvoicePaid(
  id: string,
  input: { reason: string; paidAt?: DateKey; amountInCents?: number },
): Promise<MarkPaidResult> {
  const res = await billingApi.post(
    `${invoicePath(id)}/mark-paid`,
    compact({ reason: input.reason, paidAt: input.paidAt, amountInCents: input.amountInCents }),
  );
  return res.data.data;
}

export async function waiveInvoiceBlock(
  id: string,
  input: { reason: string; until: DateKey },
): Promise<WaiveBlockResult> {
  const res = await billingApi.post(
    `${invoicePath(id)}/waive-block`,
    compact({ reason: input.reason, until: input.until }),
  );
  return res.data.data;
}

export async function createBillingAdjustment(
  contractorUserId: string,
  input: AdjustmentInput,
): Promise<AdjustmentResult> {
  const res = await billingApi.post(
    `${contractorPath(contractorUserId)}/adjustments`,
    compact({
      direction: input.direction,
      amountInCents: input.amountInCents,
      reason: input.reason,
      vacancyId: input.vacancyId,
      requestId: input.requestId,
    }),
  );
  return res.data.data;
}

/** Fecha agora uma fatura extraordinária com o que está aberto. */
export async function closeInvoiceNow(
  contractorUserId: string,
  input: { reason: string },
): Promise<Omit<AdminInvoiceListItem, "lastMessage">> {
  const res = await billingApi.post(`${contractorPath(contractorUserId)}/close-now`, {
    reason: input.reason.trim(),
  });
  return res.data.data;
}

/** Indicadores do topo. O período vale só para o "Recebido" (padrão: o mês corrente). */
export async function getBillingSummary(
  params: { period?: SummaryPeriod; from?: DateKey; to?: DateKey } = {},
): Promise<BillingSummary> {
  const res = await billingApi.get("/billing/summary", { params: compact({ ...params }) });
  return res.data.data;
}

/** Erro de uma rota de faturamento: o que a tela precisa para decidir o texto. */
export function billingErrorOf(err: unknown): {
  status: number | null;
  code: string | null;
  message: string | null;
} {
  const { status, code, message } = apiErrorOf(err);
  return { status, code, message };
}

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

/**
 * A nota fiscal (NFS-e) da fatura no admin (API-3g, plano §17; UX 6.10.3). Uma
 * nota por fatura paga ou quitada com crédito, com a competência no dia do
 * fechamento (Brasília). `NONE` = taxa líquida zero: não há nota, só a conta.
 */
export type InvoiceNfseStatus = "PENDING" | "ISSUED" | "FAILED" | "NONE";

export interface AdminInvoiceNfse {
  status: InvoiceNfseStatus;
  number: string | null;
  pdfUrl: string | null;
  issuedAt: string | null;
  /** Valor da nota. `null` = a API mandou um valor que não é centavos (a tela mostra "—"). */
  amountInCents: number | null;
  /** Dia do fechamento da fatura, em Brasília (`AAAA-MM-DD`). `null` = fora do formato ("—"). */
  competenceDate: DateKey | null;
  /** A conta da nota: Σ das taxas das linhas SERVICE, menos cupom e estorno parcial automático. */
  calc: string;
  /** A fonte da conta (texto pronto da API). */
  source: string;
  /** Só na FAILED: o motivo que a emissora devolveu. */
  failureReason: string | null;
  /**
   * Último dia (Brasília) da janela de 14 dias depois do pagamento em que a
   * varredura ainda reenvia. `null` = sem reenvio automático (6 reenvios feitos,
   * ou falha que reenviar não resolve, como tomador sem CPF/CNPJ).
   */
  retryUntil: DateKey | null;
  /** A partir de quando sai o próximo reenvio automático (ISO). `null` = nenhum pendente. */
  nextRetryAt: string | null;
}

const NFSE_STATUSES: ReadonlySet<string> = new Set(["PENDING", "ISSUED", "FAILED", "NONE"]);

const textOrNull = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

/** Centavos: inteiro, não negativo. Qualquer outra coisa é dado quebrado. */
const centsOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

const DATE_KEY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const dateKeyOrNull = (value: unknown): DateKey | null =>
  typeof value === "string" && DATE_KEY.test(value) ? value : null;

/**
 * O link do PDF vai para um `href`: só `https:` passa. `javascript:`, `data:`,
 * `http:` ou texto que não é URL viram `null` (a tela diz que o PDF não está
 * disponível, em vez de abrir algo perigoso).
 */
function httpsUrlOrNull(value: unknown): string | null {
  const text = textOrNull(value)?.trim();
  if (!text) return null;
  try {
    return new URL(text).protocol === "https:" ? text : null;
  } catch {
    return null;
  }
}

/**
 * Lê o `nfse` do detalhe. Ausente (API anterior à 3g), nulo ou com situação
 * desconhecida → `null` (a tela diz quando a nota sai). Os campos só do admin
 * que faltarem ficam `null`; valor, competência ou PDF malformados também
 * (a situação da nota continua valendo).
 */
export function adminInvoiceNfseOf(raw: unknown): AdminInvoiceNfse | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.status !== "string" || !NFSE_STATUSES.has(r.status)) return null;
  return {
    status: r.status as InvoiceNfseStatus,
    number: textOrNull(r.number),
    pdfUrl: httpsUrlOrNull(r.pdfUrl),
    issuedAt: textOrNull(r.issuedAt),
    amountInCents: centsOrNull(r.amountInCents),
    competenceDate: dateKeyOrNull(r.competenceDate),
    calc: typeof r.calc === "string" ? r.calc : "",
    source: typeof r.source === "string" ? r.source : "",
    failureReason: textOrNull(r.failureReason),
    retryUntil: textOrNull(r.retryUntil),
    nextRetryAt: textOrNull(r.nextRetryAt),
  };
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
    /**
     * "Reemitir nota" da NFS-e RECUSADA da fatura. Ausente = API anterior à
     * reemissão manual: a tela não mostra o botão.
     */
    nfseReissue?: ActionState;
  };
  /**
   * A NFS-e da fatura (API-3g). `null` antes do pagamento, na cancelada, na
   * paga cuja nota ainda não foi pedida, ou com a API anterior ao campo.
   */
  nfse: AdminInvoiceNfse | null;
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

/** Uma fatia de um número: quantos e quanto. */
export interface CountAndValue {
  count: number;
  valueInCents: number;
}

/**
 * O "Adiantado aos freelancers" separado pelo motivo de o Pix ter saído antes da
 * fatura paga (ADR-017, API #603): no encerramento (vaga de antes da regra ou
 * troca de modo), no teto, pelo "Pagar agora" do admin, ou com a fatura
 * cancelada. A soma das quatro é o valor do card.
 */
export interface AdvancedBreakdown {
  onCompletion: CountAndValue;
  deadline: CountAndValue;
  admin: CountAndValue;
  invoiceCancelled: CountAndValue;
}

/** Card "Retido aguardando a fatura" do resumo (ADR-017, API #603). */
export interface HeldSummaryCard extends SummaryCard {
  dueIn48hInCents: number;
  dueIn48hCount: number;
  overdueInCents: number;
  overdueCount: number;
  nextDeadlineAt: string | null;
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
      /** Aditivo (API #603). Ausente na API de antes: a composição não aparece. */
      breakdown?: AdvancedBreakdown;
    };
    /** Aditivo (API #603). Ausente na API de antes: o card não aparece. */
    held?: HeldSummaryCard;
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

// ─── Empresas faturadas (aba do Financeiro) ──────────────────────────────────

/** Um número da linha da empresa: pronto para a célula, com a conta e a fonte. */
export interface CompanyFigure {
  valueInCents: number;
  count: number;
  /** "2 vagas · R$ 249,62". */
  label: string;
  calc: string;
  source: string;
}

export type BillingCompanyStandingCode = "EM_DIA" | "VENCIDA" | "BLOQUEADA";

export interface BillingCompanyItem {
  /** User.id do dono da empresa. */
  contractorUserId: string;
  name: string | null;
  /** CNPJ (ou CPF) só com dígitos. */
  document: string | null;
  mode: BillingMode;
  /** "Faturado semanal"; "Pré-pago (com pendência)" para quem voltou ao pré-pago. */
  modeLabel: string;
  modeSince: string | null;
  nextClose: {
    closeDate: DateKey;
    dueDate: DateKey;
    /** "sex 16/10, 08:00 · vence seg 19/10". */
    label: string;
    /** Aviso quando, por enquanto, nada cai neste fechamento. */
    note: string | null;
    calc: string;
    source: string;
  } | null;
  openPeriod: CompanyFigure & { debitsInCents: number; creditsInCents: number };
  acceptedUpcoming: CompanyFigure & { nextServiceDate: DateKey | null };
  inReview: CompanyFigure;
  /** Terminou há mais de 35 dias sem desfecho (precisa do suporte). Ausente em API anterior. */
  stale?: CompanyFigure & { oldestEndDate: DateKey | null };
  openInvoices: CompanyFigure & { nextDueDate: DateKey | null };
  standing: {
    code: BillingCompanyStandingCode;
    /** "Em dia", "Vencida há 3 dias", "Bloqueada · vencida há 5 dias". */
    label: string;
    overdueDays: number;
    calc: string | null;
  };
}

/** Corpo do `GET /v1/admin/billing/companies`. */
export interface BillingCompanies {
  generatedAt: string;
  /** `false` com a chave do faturamento desligada (lista vazia). */
  invoicingEnabled: boolean;
  blockEnabled?: boolean;
  cards: {
    companies: SummaryCard & {
      weekly: number;
      biweekly: number;
      monthly: number;
      prepaidWithPending: number;
    };
    unbilled: SummaryCard;
    accepted: SummaryCard & {
      inReviewCount: number;
      inReviewInCents: number;
      staleCount?: number;
      staleInCents?: number;
    };
  };
  items: BillingCompanyItem[];
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

/** Situação da nota logo depois da reemissão. */
export type InvoiceNfseReissueStatus = "PENDING" | "ISSUED" | "FAILED";

export interface InvoiceNfseReissueResult {
  /**
   * PENDING = enviada à prefeitura (responde em minutos); ISSUED = emitida na
   * hora; FAILED = recusada de novo. `null` = a API mandou outra coisa (a tela
   * não afirma o resultado, só recarrega a nota).
   */
  status: InvoiceNfseReissueStatus | null;
  number: string | null;
  failureReason: string | null;
}

const REISSUE_STATUSES: ReadonlySet<string> = new Set(["PENDING", "ISSUED", "FAILED"]);

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
  const detail = res.data.data;
  return { ...detail, nfse: adminInvoiceNfseOf(detail?.nfse) };
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

/**
 * Reemite a NFS-e RECUSADA da fatura (FINANCE). A nota vai de novo para a
 * prefeitura com os dados ATUAIS da empresa; a fatura não muda. A resposta é
 * lida campo a campo: situação desconhecida vira `null`, nunca um "emitida".
 */
export async function reissueInvoiceNfse(
  id: string,
  input: { reason: string },
): Promise<InvoiceNfseReissueResult> {
  const res = await billingApi.post(`${invoicePath(id)}/nfse/reissue`, {
    reason: input.reason.trim(),
  });
  const raw = (res.data?.data ?? {}) as Record<string, unknown>;
  return {
    status:
      typeof raw.status === "string" && REISSUE_STATUSES.has(raw.status)
        ? (raw.status as InvoiceNfseReissueStatus)
        : null,
    number: textOrNull(raw.number),
    failureReason: textOrNull(raw.failureReason),
  };
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

/** Empresas no faturado (e quem voltou ao pré-pago com pendência), com os números de cada uma. */
export async function getBillingCompanies(): Promise<BillingCompanies> {
  const res = await billingApi.get("/billing/companies");
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

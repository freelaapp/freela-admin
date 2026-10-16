import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import type {
  AdvancedBreakdown,
  CountAndValue,
  HeldSummaryCard,
} from "./billing-api";
import type { DateKey } from "./billing-mode-api";

/**
 * Pagamentos aos freelancers retidos até a fatura da empresa (ADR-017, API #603).
 * Rotas do papel Financeiro (`FINANCE`):
 * - `GET /v1/admin/billing/held-repasses?situation&page&pageSize`: quem espera,
 *   quanto, de qual fatura e até quando a Freela garante (teto), do teto mais
 *   próximo para o mais longe;
 * - `POST /v1/admin/repasses/:repasseId/release { reason }`: "Pagar agora".
 *
 * Antes do deploy do #603 as duas rotas dão 404: quem chama decide o aviso calmo.
 * A leitura é defensiva: item sem os campos de que a tela precisa é descartado
 * (nunca vira uma linha com R$ 0,00 ou data inventada).
 */
const adminApi = createAuthedClient("/v1/admin");

export type HeldSituation = "awaiting_close" | "invoice_open" | "invoice_overdue" | "releasing";

/** Filtros que a rota aceita (o `releasing` não é filtro: aparece em "Todas"). */
export type HeldSituationFilter =
  | "all"
  | "awaiting_close"
  | "invoice_open"
  | "invoice_overdue"
  | "deadline_48h";

export interface HeldRepasseItem {
  repasseId: string;
  vacancyId: string;
  vacancyTitle: string | null;
  /** Dia de Brasília do serviço. */
  serviceDate: DateKey | null;
  /**
   * `hasPixKey`: `true`/`false` = o que a API sabe da chave Pix do freelancer;
   * `null` = a API não mandou o campo (não sabemos: o "Pagar agora" fica
   * disponível e a API valida).
   */
  freelancer: { providerGlobalId: string; name: string | null; hasPixKey: boolean | null };
  company: { contractorUserId: string | null; name: string | null };
  /** O que o freelancer recebe (o valor retido). */
  amountInCents: number;
  heldAt: string;
  /** Vencimento da fatura emitida; sem fatura, o previsto na retenção. */
  expectedDate: DateKey;
  /** Teto: instante (00:00 de Brasília) em que a Freela paga se a empresa não pagar. */
  effectiveDeadlineAt: string;
  invoice: { id: string; number: string; status: string; dueDate: DateKey } | null;
  situation: HeldSituation;
  /** A liberação já foi autorizada (fatura paga, teto ou admin): a varredura paga. */
  releaseAuthorized: boolean;
  /** A conta do teto, pronta. */
  calc: string;
  source: string;
}

export interface HeldTotals {
  count: number;
  totalInCents: number;
}

export interface HeldRepassesTotals {
  all: HeldTotals;
  awaitingClose: HeldTotals;
  invoiceOpen: HeldTotals;
  invoiceOverdue: HeldTotals;
  releasing: HeldTotals;
  deadline48h: HeldTotals;
  calc: string;
  source: string;
}

export interface HeldRepassesList {
  items: HeldRepasseItem[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  /** Somas de TODOS os retidos (não do filtro). `null` se a API não mandou. */
  totals: HeldRepassesTotals | null;
}

export interface HeldRepassesParams {
  situation?: HeldSituationFilter;
  page?: number;
  pageSize?: number;
}

export interface ReleaseRepasseResult {
  repasseId: string;
  vacancyId: string;
  /** Situação do repasse depois do "Pagar agora" (`COMPLETED`, `FAILED`, ...). `null` se veio outra coisa. */
  status: string | null;
  failureReason: string | null;
}

// ─── Leitura defensiva ───────────────────────────────────────────────────────

type Obj = Record<string, unknown>;

const isObj = (value: unknown): value is Obj => !!value && typeof value === "object";
const text = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;
const textOr = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;
const cents = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const count = cents;

const DATE_KEY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const dateKey = (value: unknown): DateKey | null =>
  typeof value === "string" && DATE_KEY.test(value) ? value : null;
const instant = (value: unknown): string | null =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;

const SITUATIONS: ReadonlySet<string> = new Set([
  "awaiting_close",
  "invoice_open",
  "invoice_overdue",
  "releasing",
]);

function invoiceOf(raw: unknown): HeldRepasseItem["invoice"] {
  if (!isObj(raw)) return null;
  const id = text(raw.id);
  const number = text(raw.number);
  const dueDate = dateKey(raw.dueDate);
  if (!id || !number || !dueDate) return null;
  return { id, number, status: textOr(raw.status, ""), dueDate };
}

/** Um item da lista. Sem id, valor, teto ou situação conhecida → `null` (descartado). */
export function heldRepasseItemOf(raw: unknown): HeldRepasseItem | null {
  if (!isObj(raw)) return null;
  const repasseId = text(raw.repasseId);
  const vacancyId = text(raw.vacancyId);
  const amountInCents = cents(raw.amountInCents);
  const effectiveDeadlineAt = instant(raw.effectiveDeadlineAt);
  const expectedDate = dateKey(raw.expectedDate);
  const situation = typeof raw.situation === "string" && SITUATIONS.has(raw.situation)
    ? (raw.situation as HeldSituation)
    : null;
  if (!repasseId || !vacancyId || amountInCents === null || !effectiveDeadlineAt || !expectedDate || !situation) {
    return null;
  }
  const freelancer = isObj(raw.freelancer) ? raw.freelancer : {};
  const company = isObj(raw.company) ? raw.company : {};
  return {
    repasseId,
    vacancyId,
    vacancyTitle: text(raw.vacancyTitle),
    serviceDate: dateKey(raw.serviceDate),
    freelancer: {
      providerGlobalId: textOr(freelancer.providerGlobalId, ""),
      name: text(freelancer.name),
      // Ausente ≠ `false`: só o `false` explícito diz "sem chave Pix".
      hasPixKey: typeof freelancer.hasPixKey === "boolean" ? freelancer.hasPixKey : null,
    },
    company: { contractorUserId: text(company.contractorUserId), name: text(company.name) },
    amountInCents,
    heldAt: textOr(raw.heldAt, ""),
    expectedDate,
    effectiveDeadlineAt,
    invoice: invoiceOf(raw.invoice),
    situation,
    releaseAuthorized: raw.releaseAuthorized === true,
    calc: textOr(raw.calc, ""),
    source: textOr(raw.source, ""),
  };
}

function totalsPartOf(raw: unknown): HeldTotals | null {
  if (!isObj(raw)) return null;
  const c = count(raw.count);
  const total = cents(raw.totalInCents);
  return c === null || total === null ? null : { count: c, totalInCents: total };
}

/** `meta.totals` inteiro, ou `null` se faltar alguma parte (os cards somem). */
export function heldTotalsOf(raw: unknown): HeldRepassesTotals | null {
  if (!isObj(raw)) return null;
  const all = totalsPartOf(raw.all);
  const awaitingClose = totalsPartOf(raw.awaitingClose);
  const invoiceOpen = totalsPartOf(raw.invoiceOpen);
  const invoiceOverdue = totalsPartOf(raw.invoiceOverdue);
  const releasing = totalsPartOf(raw.releasing);
  const deadline48h = totalsPartOf(raw.deadline48h);
  if (!all || !awaitingClose || !invoiceOpen || !invoiceOverdue || !releasing || !deadline48h) {
    return null;
  }
  return {
    all,
    awaitingClose,
    invoiceOpen,
    invoiceOverdue,
    releasing,
    deadline48h,
    calc: textOr(raw.calc, ""),
    source: textOr(raw.source, ""),
  };
}

function countAndValueOf(raw: unknown): CountAndValue | null {
  if (!isObj(raw)) return null;
  const c = count(raw.count);
  const value = cents(raw.valueInCents);
  return c === null || value === null ? null : { count: c, valueInCents: value };
}

/**
 * `cards.advanced.breakdown` do resumo (API #603). Ausente ou com alguma das
 * quatro fatias quebrada → `null` (a composição não aparece).
 */
export function advancedBreakdownOf(raw: unknown): AdvancedBreakdown | null {
  if (!isObj(raw)) return null;
  const onCompletion = countAndValueOf(raw.onCompletion);
  const deadline = countAndValueOf(raw.deadline);
  const admin = countAndValueOf(raw.admin);
  const invoiceCancelled = countAndValueOf(raw.invoiceCancelled);
  if (!onCompletion || !deadline || !admin || !invoiceCancelled) return null;
  return { onCompletion, deadline, admin, invoiceCancelled };
}

/** `cards.held` do resumo (API #603). Ausente ou malformado → `null` (o card não aparece). */
export function heldSummaryCardOf(raw: unknown): HeldSummaryCard | null {
  if (!isObj(raw)) return null;
  const valueInCents = cents(raw.valueInCents);
  const c = count(raw.count);
  const label = text(raw.label);
  if (valueInCents === null || c === null || !label) return null;
  return {
    label,
    valueInCents,
    count: c,
    calc: textOr(raw.calc, ""),
    source: textOr(raw.source, ""),
    meta: textOr(raw.meta, ""),
    help: textOr(raw.help, ""),
    dueIn48hInCents: cents(raw.dueIn48hInCents) ?? 0,
    dueIn48hCount: count(raw.dueIn48hCount) ?? 0,
    overdueInCents: cents(raw.overdueInCents) ?? 0,
    overdueCount: count(raw.overdueCount) ?? 0,
    nextDeadlineAt: instant(raw.nextDeadlineAt),
  };
}

// ─── Rotas ───────────────────────────────────────────────────────────────────

/** Lista "Aguardando fatura". O filtro `all` não vai na URL (é o padrão da API). */
export async function listHeldRepasses(params: HeldRepassesParams = {}): Promise<HeldRepassesList> {
  const query: Record<string, string | number> = {};
  if (params.situation && params.situation !== "all") query.situation = params.situation;
  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;
  const res = await adminApi.get("/billing/held-repasses", { params: query });
  const rawItems: unknown[] = Array.isArray(res.data?.data) ? res.data.data : [];
  const meta = isObj(res.data?.meta) ? res.data.meta : {};
  const items = rawItems
    .map(heldRepasseItemOf)
    .filter((item): item is HeldRepasseItem => item !== null);
  return {
    items,
    page: count(meta.page) ?? 1,
    pageSize: count(meta.pageSize) ?? (params.pageSize ?? 50),
    total: count(meta.total) ?? items.length,
    hasMore: meta.hasMore === true,
    totals: heldTotalsOf(meta.totals),
  };
}

/**
 * "Pagar agora": libera o repasse retido. O admin vem do token; o motivo fica na
 * trilha do repasse. A API não paga duas vezes: o segundo pedido recebe 409
 * (`REPASSE_ALREADY_RELEASED` ou `REPASSE_NOT_HELD`).
 */
export async function releaseHeldRepasse(
  repasseId: string,
  input: { reason: string },
): Promise<ReleaseRepasseResult> {
  const res = await adminApi.post(`/repasses/${encodeURIComponent(repasseId)}/release`, {
    reason: input.reason.trim(),
  });
  const raw = isObj(res.data?.data) ? res.data.data : {};
  return {
    repasseId: textOr(raw.repasseId, repasseId),
    vacancyId: textOr(raw.vacancyId, ""),
    status: text(raw.status),
    failureReason: text(raw.failureReason),
  };
}

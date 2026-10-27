import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Modo de cobrança da empresa (API #584, ADR-016, Fase 3). Rota própria do
 * admin com permissão FINANCE (sem ela, 403). Toda mudança leva motivo (>= 5
 * caracteres, 422 `REASON_REQUIRED`) e fica no histórico das preferências.
 *
 * Com `CONTRACTOR_INVOICING_ENABLED` desligada, o GET devolve `editable: false`
 * (e o modo sempre `PREPAID`) e o PATCH responde 404 `FEATURE_DISABLED`.
 */
const billingModeApi = createAuthedClient("/v1/admin");

// ─── Tipos (espelham `BillingModeAdminView` da API) ─────────────────────────

export type BillingMode = "PREPAID" | "INVOICED_7" | "INVOICED_15" | "INVOICED_30";
export type InvoicedMode = Exclude<BillingMode, "PREPAID">;

/** Campo do cadastro que falta para faturar (422 `BILLING_REQUIRES_COMPANY_DATA`). */
export type CompanyDataField =
  | "cnpj"
  | "cep"
  | "street"
  | "number"
  | "neighborhood"
  | "city"
  | "uf"
  | "email";

/** Dia civil de Brasília, `AAAA-MM-DD`. */
export type DateKey = string;

/** Datas da fatura em que um serviço de hoje cairia, em cada ciclo. */
export interface ServiceBillingDates {
  period: { start: DateKey; end: DateKey };
  closeDate: DateKey;
  dueDate: DateKey;
  /** Dia em que o bloqueio começaria, às 00:00, se a fatura não for paga. */
  blockFromDate: DateKey;
}

export interface BillingModeSettings {
  mode: BillingMode;
  /** Desde quando vale o modo atual (ISO); nulo sem troca registrada. */
  since: string | null;
  /** E-mail do financeiro; nulo = usar o de contato. */
  email: string | null;
  contactEmail: string | null;
  /** `false` com o faturamento desligado. */
  editable: boolean;
  requirements: { missing: CompanyDataField[] };
  appUsage: { lastAppDay: DateKey | null };
  previews: Record<InvoicedMode, ServiceBillingDates>;
  /** Só no faturado: o que está anotado e ainda sem fatura. */
  openPreview: {
    lineCount: number;
    debitsInCents: number;
    creditsInCents: number;
    totalInCents: number;
    calc: string;
  } | null;
  /** Só no faturado: as datas de uma fatura fechada hoje. */
  extraordinaryInvoice: { closeDate: DateKey; dueDate: DateKey; blockFromDate: DateKey } | null;
  /** "06:00" ou "08:00" (plano 2026-10-22 §2.8). Ausente na API de antes: vale "08:00". */
  closeHourLabel?: string;
  /**
   * Agenda da fatura da empresa (27/10/2026). Ausente na API de antes: a tela não
   * mostra os campos. `closeWeekday`/`dueDays` nulos = o padrão.
   */
  schedule?: BillingScheduleSettings;
}

export interface BillingScheduleSettings {
  /** Dia do fechamento no semanal (0 = domingo … 6 = sábado); nulo = padrão. */
  closeWeekday: number | null;
  /** Dias do fechamento ao vencimento; nulo = padrão. */
  dueDays: number | null;
  effectiveCloseWeekday: number;
  effectiveDueDays: number;
  defaultCloseWeekday: number;
  defaultDueDays: number;
  maxDueDays: number;
}

export interface UpdateBillingModeInput {
  billingMode?: BillingMode;
  /** Vazio ou `null` = usar o e-mail de contato. */
  billingEmail?: string | null;
  /** Dia do fechamento no semanal; `null` = voltar ao padrão. */
  closeWeekday?: number | null;
  /** Dias até o vencimento; `null` = voltar ao padrão. */
  dueDays?: number | null;
  reason: string;
}

// ─── Funções ────────────────────────────────────────────────────────────────

const billingPath = (contractorUserId: string) =>
  `/billing/contractors/${encodeURIComponent(contractorUserId)}`;

export async function getBillingModeSettings(
  contractorUserId: string,
): Promise<BillingModeSettings> {
  const res = await billingModeApi.get(billingPath(contractorUserId));
  return res.data.data;
}

/** Manda só o que mudou (campo ausente = mantém) e o motivo. */
export async function updateBillingMode(
  contractorUserId: string,
  input: UpdateBillingModeInput,
): Promise<BillingModeSettings> {
  const body: Record<string, unknown> = {};
  if (input.billingMode !== undefined) body.billingMode = input.billingMode;
  if (input.billingEmail !== undefined) body.billingEmail = input.billingEmail?.trim() || null;
  body.reason = input.reason.trim();
  const res = await billingModeApi.patch(`${billingPath(contractorUserId)}/mode`, body);
  return res.data.data;
}

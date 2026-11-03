import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import type { DateKey } from "./billing-mode-api";

/**
 * Financeiro > Notas fiscais: `GET /v1/admin/fiscal-documents` (FINANCE). As
 * NFS-e da fatura (faturado), da vaga (pré-pago) e da mensalidade numa lista só.
 * Todo número vem pronto da API com a conta e a fonte; a tela não recalcula.
 */
const adminApi = createAuthedClient("/v1/admin");

export type FiscalDocumentKind = "INVOICE" | "VACANCY" | "SUBSCRIPTION";
export type FiscalDocumentStatus = "PENDING" | "ISSUED" | "FAILED";

export interface FiscalDocumentReissue {
  /** Qual rota reemite: a da fatura (com motivo) ou a da vaga; `null` = não há. */
  via: "INVOICE" | "VACANCY" | null;
  enabled: boolean;
  /** Por que não dá, quando `enabled` é falso. */
  reason: string | null;
}

export interface FiscalDocumentItem {
  id: string;
  kind: FiscalDocumentKind;
  /** "Fatura (faturado)", "Vaga (pré-pago)", "Mensalidade (assinatura)". */
  kindLabel: string;
  status: FiscalDocumentStatus;
  /** "Na prefeitura", "Emitida", "Recusada". */
  statusLabel: string;
  /** Número da prefeitura (só a emitida). */
  number: string | null;
  failureReason: string | null;
  pdfUrl: string | null;
  company: { contractorUserId: string | null; name: string | null };
  subject: {
    invoiceId: string | null;
    invoiceNumber: string | null;
    invoiceStatus: string | null;
    vacancyId: string | null;
    vacancyTitle: string | null;
    subscriptionChargeId: string | null;
    /** "Fatura FAT-2026-000120", "Vaga Garçom", "Mensalidade do plano". */
    label: string;
  };
  amount: { inCents: number; formatted: string; calc: string | null; source: string };
  issuedAt: string | null;
  createdAt: string;
  /** Última mudança (pedido, emissão, recusa, reemissão): o período filtra por ela. */
  updatedAt: string;
  reissue: FiscalDocumentReissue;
}

export interface FiscalDocumentFigure {
  count: number;
  label: string;
  calc: string;
  source: string;
}

export interface FiscalDocumentList {
  items: FiscalDocumentItem[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  /** O dia de início do período (Brasília) que a API aplicou. */
  since: DateKey;
  summary: {
    total: FiscalDocumentFigure;
    byStatus: Array<FiscalDocumentFigure & { status: FiscalDocumentStatus }>;
  };
}

export interface FiscalDocumentListParams {
  type?: FiscalDocumentKind;
  status?: FiscalDocumentStatus;
  since?: DateKey;
  page?: number;
}

export async function listAdminFiscalDocuments(
  params: FiscalDocumentListParams = {},
): Promise<FiscalDocumentList> {
  const query: Record<string, string | number> = {};
  if (params.type) query.type = params.type;
  if (params.status) query.status = params.status;
  if (params.since) query.since = params.since;
  if (params.page && params.page > 1) query.page = params.page;
  const res = await adminApi.get("/fiscal-documents", { params: query });
  const meta = res.data?.meta ?? {};
  return {
    items: res.data?.data ?? [],
    page: meta.page ?? 1,
    pageSize: meta.pageSize ?? 30,
    total: meta.total ?? 0,
    hasMore: meta.hasMore ?? false,
    since: meta.since ?? params.since ?? "",
    summary: meta.summary ?? {
      total: { count: 0, label: "Notas no período", calc: "", source: "" },
      byStatus: [],
    },
  };
}

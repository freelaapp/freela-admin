import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const adminApi = createAuthedClient("/v1/admins");

// ─── Tipos ──────────────────────────────────────────────────────────────────
// Contrato: api-freela/docs/superpowers/specs/2026-08-24-epico-servicos-design.md §1c e §4.7.

export type DeliveryChannel = "EMAIL" | "WHATSAPP" | "WHATSAPP_GROUP" | "PUSH";
export type HealthStatus = "OK" | "DEGRADED" | "DOWN" | "IDLE";

export interface ChannelHealth {
  channel: DeliveryChannel;
  last24h: { sent: number; failed: number };
  lastSuccessAt: string | null;
  lastFailure: { at: string; error: string | null; kind: string | null } | null;
  /** DOWN = últimas 5 falharam; DEGRADED = ≥ 20 % de falha em 24 h; IDLE = nada em 24 h. */
  status: HealthStatus;
}

export interface ProviderHealth {
  /** whatsapp-bridge | ses | openpix | asaas | database */
  name: string;
  status: HealthStatus | string;
  detail: string | null;
  checkedAt: string | null;
}

export interface SchedulerHealth {
  name: string;
  lastFinishedAt: string | null;
  lastStatus: "OK" | "ERROR" | null;
  lastError: string | null;
  /** Sem execução há mais de 2× o intervalo. */
  overdue: boolean;
}

export interface AttendanceFlowItem {
  jobId: string;
  vacancyId: string;
  vacancyTitle: string | null;
  contractorName: string | null;
  providerName: string | null;
  /** PENDING_CONTRACTOR_CONFIRMATION | PENDING_PROVIDER_CONFIRMATION | SUPPORT_TICKET_REQUESTED | ... */
  status: string;
  contractorReason: string | null;
  openedAt: string;
}

export interface AttendanceSummary {
  pendingContractor: number;
  contested: number;
  supportTickets: number;
  items: AttendanceFlowItem[];
}

export interface SystemHealth {
  generatedAt: string;
  channels: ChannelHealth[];
  providers: ProviderHealth[];
  schedulers: SchedulerHealth[];
  attendance: AttendanceSummary;
  systemScore: { avg30d: number | null; count30d: number };
}

export type AttendanceOutcome = "ATTENDED" | "NO_SHOW";

export interface ResolveAttendanceInput {
  jobId: string;
  outcome: AttendanceOutcome;
  note?: string;
}

// ─── Chamadas ───────────────────────────────────────────────────────────────

export async function getSystemHealth(): Promise<SystemHealth> {
  const res = await adminApi.get("/system-health");
  return res.data.data;
}

/** A API devolve `{ total, items }`; a forma antiga do contrato era um array. */
export function toAttendanceList(payload: unknown): AttendanceFlowItem[] {
  if (Array.isArray(payload)) return payload as AttendanceFlowItem[];
  const items = (payload as { items?: unknown } | undefined)?.items;
  return Array.isArray(items) ? (items as AttendanceFlowItem[]) : [];
}

export async function getAttendanceFlows(): Promise<AttendanceFlowItem[]> {
  const res = await adminApi.get("/attendance");
  return toAttendanceList(res.data.data);
}

export async function resolveAttendanceFlow({
  jobId,
  outcome,
  note,
}: ResolveAttendanceInput): Promise<void> {
  // Nota vazia não vai: o DTO pode recusar string vazia e derrubar a decisão.
  const body: { outcome: AttendanceOutcome; note?: string } = { outcome };
  const trimmed = note?.trim();
  if (trimmed) body.note = trimmed;
  await adminApi.post(`/attendance/${jobId}/resolve`, body);
}

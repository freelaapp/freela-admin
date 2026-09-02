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

/**
 * Canal de avisos internos da equipe (vaga nova, assinatura, suporte).
 * `group` = grupo de WhatsApp configurado em `ADMIN_ALERT_GROUP`; `phones` =
 * caminho antigo, telefones das envs `*_ALERT_PHONES`.
 */
export interface AdminAlertChannelStatus {
  mode: "group" | "phones";
  group: { name: string; id: string | null; resolved: boolean; error?: string } | null;
  /** Quantos telefones distintos existem nas envs `*_ALERT_PHONES`. */
  phones: number;
}

export type AdminAlertDelivery =
  | { target: "group"; groupId?: string; ok: boolean; error?: string }
  | { target: "phones"; sent?: number; failed?: number; ok?: boolean }
  | { target: "skipped"; reason?: "no_recipients" | "no_provider" | string };

export type AdminAlertTestResult = AdminAlertChannelStatus & {
  error?: string;
  delivery?: AdminAlertDelivery | null;
};

export interface SystemHealth {
  generatedAt: string;
  channels: ChannelHealth[];
  providers: ProviderHealth[];
  schedulers: SchedulerHealth[];
  attendance: AttendanceSummary;
  systemScore: { avg30d: number | null; count30d: number };
  /** Opcional: API anterior a 26/08 não devolve. */
  adminAlertChannel?: AdminAlertChannelStatus | null;
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

// ─── Avisos internos ────────────────────────────────────────────────────────

/** Manda "Teste do canal de avisos da Freela" pelo mesmo caminho dos avisos reais. SUPER_ADMIN. */
export async function sendAdminAlertTest(): Promise<AdminAlertTestResult> {
  const res = await adminApi.post("/alerts/test");
  return res.data.data;
}

export interface AlertTestOutcome {
  tone: "success" | "warning" | "error";
  message: string;
}

/**
 * Traduz o resultado do teste numa frase para o toast. Função pura: o
 * `delivery` tem três formas e o painel não deve pintar de verde um `skipped`.
 */
export function describeAlertTest(result: AdminAlertTestResult | null | undefined): AlertTestOutcome {
  const delivery = result?.delivery;
  const groupName = result?.group?.name;
  const groupLabel = groupName ? `"${groupName}"` : "de WhatsApp";

  if (!delivery) {
    return { tone: "error", message: result?.error ?? "A API não informou se o teste saiu." };
  }

  if (delivery.target === "group") {
    if (delivery.ok) return { tone: "success", message: `Teste enviado ao grupo ${groupLabel}.` };
    const detail = delivery.error ?? result?.group?.error ?? result?.error;
    return {
      tone: "error",
      message: `O grupo ${groupLabel} não recebeu o teste.${detail ? ` ${detail}` : ""}`,
    };
  }

  if (delivery.target === "phones") {
    const sent = delivery.sent ?? (delivery.ok ? 1 : 0);
    const failed = delivery.failed ?? 0;
    if (sent > 0 && failed === 0) {
      return { tone: "success", message: `Teste enviado a ${sent} ${sent === 1 ? "telefone" : "telefones"}.` };
    }
    if (sent > 0) {
      return { tone: "warning", message: `Teste chegou a ${sent}, falhou em ${failed}.` };
    }
    return {
      tone: "error",
      message: failed > 0 ? `O teste falhou nos ${failed} telefones.` : "Nenhum telefone recebeu o teste.",
    };
  }

  const reason = delivery.reason;
  if (reason === "no_provider") {
    return { tone: "error", message: "WhatsApp não está configurado neste ambiente — nada foi enviado." };
  }
  if (reason === "no_recipients") {
    return {
      tone: "error",
      message: "Ninguém para receber: configure ADMIN_ALERT_GROUP ou os telefones em *_ALERT_PHONES.",
    };
  }
  return { tone: "error", message: `Teste não enviado${reason ? ` (${reason})` : ""}.` };
}

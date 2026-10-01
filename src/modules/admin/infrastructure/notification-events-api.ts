import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const api = createAuthedClient("/v1/admins/notification-events");

export type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED" | "MISSING";

export type TemplateCategory = "UTILITY" | "AUTHENTICATION";

export interface LegacyCutView {
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface NotificationEventsPayload {
  events: NotificationEventView[];
  legacyCut: LegacyCutView;
}

export interface NotificationEventView {
  eventKey: string;
  label: string;
  audience: "provider" | "contractor";
  metaEnabled: boolean;
  updatedAt: string | null;
  template: { name: string; status: TemplateStatus; category: string | null; rejectedReason: string | null };
  /** Categoria pedida à Meta (API fase 2). Ausente na API antiga = UTILITY. */
  templateCategory?: TemplateCategory;
  categoryWarning: boolean;
  last7Days: { sent: number; delivered: number; read: number; failed: number };
}

/** Uma única chamada pesada: traz a lista de avisos e o estado do corte do WhatsApp antigo. */
export async function fetchNotificationEvents(): Promise<NotificationEventsPayload> {
  const res = await api.get("");
  return {
    events: res.data.data,
    legacyCut: res.data.legacyCut ?? { enabled: false, updatedAt: null, updatedBy: null },
  };
}

export async function setNotificationEvent(eventKey: string, enabled: boolean): Promise<void> {
  await api.put(`/${eventKey}`, { enabled });
}

export async function submitNotificationTemplate(eventKey: string): Promise<void> {
  await api.post(`/${eventKey}/submit-template`);
}

export async function sendNotificationTest(eventKey: string, phone: string): Promise<void> {
  await api.post(`/${eventKey}/test`, { phone });
}

export async function setLegacyCut(enabled: boolean): Promise<LegacyCutView> {
  const res = await api.put("/legacy-cut", { enabled });
  return res.data.data;
}

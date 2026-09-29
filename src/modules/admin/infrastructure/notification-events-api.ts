import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const api = createAuthedClient("/v1/admins/notification-events");

export type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED" | "MISSING";

export interface NotificationEventView {
  eventKey: string;
  label: string;
  audience: "provider" | "contractor";
  metaEnabled: boolean;
  updatedAt: string | null;
  template: { name: string; status: TemplateStatus; category: string | null; rejectedReason: string | null };
  categoryWarning: boolean;
  last7Days: { sent: number; delivered: number; read: number; failed: number };
}

export async function listNotificationEvents(): Promise<NotificationEventView[]> {
  const res = await api.get("");
  return res.data.data;
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

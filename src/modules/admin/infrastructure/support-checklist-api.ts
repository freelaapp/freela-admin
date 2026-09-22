import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Checklist da área de trabalho do suporte — agora no servidor (era
 * `localStorage`). O par (vaga, ação) é a chave, o mesmo do backend.
 *
 * Isolado aqui de propósito: era o "cano" que o `support-checklist-storage`
 * (localStorage) escondia, e agora fala com a API sem que nenhuma tela mude.
 */

const api = createAuthedClient("/v1/admins/support-checklist");

/** `bars-restaurants` no painel de Empresa (o único com área de trabalho hoje). */
export type VacancyModule = "bars-restaurants" | "home-services";
export type SupportRecipient = "contractor" | "freelancer";

export interface ChecklistTickDto {
  vacancyId: string;
  actionId: string;
  /** ISO. */
  checkedAt: string;
  /** Nome de quem ticou. */
  by: string | null;
  /** Preenchidos quando a ação foi ENVIADA pela plataforma. */
  sentTo: string | null;
  sentWhatsappAt: string | null;
}

export async function getSupportChecklist(): Promise<ChecklistTickDto[]> {
  const res = await api.get("");
  return res.data.data ?? [];
}

export async function tickSupportAction(
  vacancyId: string,
  actionId: string,
  module: VacancyModule,
  by?: string | null,
): Promise<void> {
  await api.post(`/${vacancyId}/actions/${actionId}`, { module, by: by ?? undefined });
}

export async function untickSupportAction(vacancyId: string, actionId: string): Promise<void> {
  await api.delete(`/${vacancyId}/actions/${actionId}`);
}

export async function tickSupportActions(
  vacancyId: string,
  actionIds: string[],
  module: VacancyModule,
  by?: string | null,
): Promise<void> {
  await api.post(`/${vacancyId}/bulk`, { actionIds, module, by: by ?? undefined });
}

export async function sendSupportAction(
  vacancyId: string,
  input: {
    actionId: string;
    recipient: SupportRecipient;
    text: string;
    module: VacancyModule;
    by?: string | null;
  },
): Promise<{ phone: string; sentAt: string }> {
  const res = await api.post(`/${vacancyId}/send`, {
    actionId: input.actionId,
    recipient: input.recipient,
    text: input.text,
    module: input.module,
    by: input.by ?? undefined,
  });
  return res.data.data;
}

// ─── Disparo automático (fase 2): toggles por ação ──────────────────────────

export interface AutoActionSetting {
  actionId: string;
  label: string;
  enabled: boolean;
}

export interface AutoSettings {
  /** Flag mestre (env). Nada dispara sozinho com ele OFF, mesmo com ações ON. */
  globalEnabled: boolean;
  actions: AutoActionSetting[];
}

export async function getAutoSettings(): Promise<AutoSettings> {
  const res = await api.get("/auto-settings");
  return res.data.data;
}

export async function setAutoSetting(actionId: string, enabled: boolean): Promise<void> {
  await api.put(`/auto-settings/${actionId}`, { enabled });
}

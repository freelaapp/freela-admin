import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const api = createAuthedClient("/v1/admins/dedicated-notification-groups");

/**
 * Regra de grupo de WhatsApp DEDICADO a um contratante. Vagas de um contratante cujo
 * nome casa `companyMatch` (e cidade casa `cityMatch`, se informado) são enviadas TAMBÉM
 * ao grupo cujo nome segue o padrão "Notificações <label>" — ALÉM do grupo da cidade.
 */
export interface DedicatedGroupRule {
  id: string;
  label: string;
  companyMatch: string;
  cityMatch: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getDedicatedGroups(): Promise<DedicatedGroupRule[]> {
  const res = await api.get("");
  return res.data.data;
}

export async function createDedicatedGroup(input: {
  label: string;
  companyMatch: string;
  cityMatch?: string | null;
  enabled?: boolean;
}): Promise<DedicatedGroupRule> {
  const res = await api.post("", input);
  return res.data.data;
}

export async function updateDedicatedGroup(
  id: string,
  input: {
    label?: string;
    companyMatch?: string;
    cityMatch?: string | null;
    enabled?: boolean;
  },
): Promise<DedicatedGroupRule> {
  const res = await api.patch(`/${id}`, input);
  return res.data.data;
}

export async function deleteDedicatedGroup(id: string): Promise<void> {
  await api.delete(`/${id}`);
}

export interface CreatedDedicatedWhatsappGroup {
  jid: string;
  name: string;
  participants: number | null;
}

/** Cria o grupo real no WhatsApp já no padrão "Notificações <label>". */
export async function createDedicatedWhatsappGroup(
  id: string,
  participants: string[],
): Promise<CreatedDedicatedWhatsappGroup> {
  const res = await api.post(`/${id}/whatsapp-group`, { participants });
  return res.data.data;
}

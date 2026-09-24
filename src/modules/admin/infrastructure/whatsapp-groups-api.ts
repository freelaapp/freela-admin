import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const whatsappApi = createAuthedClient("/v1/admins/vacancy-group-routes");

/**
 * Cliente da tela Grupos WhatsApp (`/v1/admins/vacancy-group-routes`). Respostas em
 * `{ data }`; erros em `{ error: { code, message } }`.
 */

export interface CreatedWhatsappGroup {
  jid: string;
  name: string;
  participants: number | null;
}

/**
 * Cria um grupo de WhatsApp já no padrão "Vagas Freela <Cidade> <UF>" (o backend
 * monta o nome) para entrar no roteamento automático de vagas.
 */
export async function createWhatsappGroup(input: {
  city: string;
  uf: string;
  participants: string[];
  /** Nº do grupo da mesma cidade (2, 3…) — vira " #N" no nome. */
  sequence?: number;
}): Promise<CreatedWhatsappGroup> {
  const res = await whatsappApi.post("/groups", input);
  return res.data.data;
}

export interface AddGroupParticipantsResult {
  groupId: string;
  requested: number;
}

/**
 * Adiciona participantes (telefones com DDD) a um grupo de WhatsApp JÁ existente — o
 * mesmo campo de telefones da criação, mas para um grupo que já foi criado. O bot
 * precisa ser admin do grupo.
 */
export async function addGroupParticipants(input: {
  groupId: string;
  participants: string[];
}): Promise<AddGroupParticipantsResult> {
  const res = await whatsappApi.post("/groups/participants", input);
  return res.data.data;
}

export type AdminGroupKind = "CITY" | "DEDICATED";
export type AdminGroupSource = "PANEL" | "IMPORTED";

/** Grupo criado (ou importado uma vez) pelo painel, cruzado com o diretório do WhatsApp. */
export interface AdminGroupView {
  id: string;
  groupJid: string | null;
  name: string;
  kind: AdminGroupKind;
  source: AdminGroupSource;
  city: string | null;
  uf: string | null;
  sequence: number | null;
  dedicatedRuleId: string | null;
  createdAt: string;
  /** true = bot no grupo; false = conferido e fora; null = não deu para conferir. */
  botInGroup: boolean | null;
}

export interface AdminGroupsList {
  instance: { connected: boolean | null };
  directory: { ok: boolean; checkedAt: string | null };
  groups: AdminGroupView[];
}

/** `refresh` força o diretório do WhatsApp (ignora o cache de 5 min da API). */
export async function getAdminGroups(opts: { refresh?: boolean } = {}): Promise<AdminGroupsList> {
  const res = await whatsappApi.get("/groups", { params: opts.refresh ? { refresh: "true" } : {} });
  return res.data.data;
}

/** Excluir = o bot sai do grupo (se estiver) e o grupo sai da lista. */
export async function deleteAdminGroup(id: string): Promise<{ id: string; leftGroup: boolean }> {
  const res = await whatsappApi.delete(`/groups/${encodeURIComponent(id)}`);
  return res.data.data;
}

export interface GroupSettings {
  /** Dígitos com 55 (ex.: "5511915375766"). */
  defaultPhones: string[];
}

export async function getGroupSettings(): Promise<GroupSettings> {
  const res = await whatsappApi.get("/settings");
  return res.data.data;
}

/** A API normaliza, tira repetidos e limita a 20; inválido → 400 citando o número. */
export async function updateGroupSettings(defaultPhones: string[]): Promise<GroupSettings> {
  const res = await whatsappApi.put("/settings", { defaultPhones });
  return res.data.data;
}

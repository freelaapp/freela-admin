import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Cliente da seção "Grupos VIP" (`/v1/admin/vip-groups`). Respostas em
 * `{ data }`; erros em `{ error: { code, message } }`. Espelha o controller
 * `src/shared/vip-groups/adapters/http/vip-groups-admin.controller.ts` do api.
 */
const api = createAuthedClient("/v1/admin/vip-groups");

export type VipGroupStatus = "NONE" | "PENDING" | "ACTIVE" | "FAILED";
export type VipMemberWhatsappState = "PENDING" | "IN_GROUP" | "FAILED" | "REMOVE_PENDING";
export type VipMemberSource = "FUNNEL" | "TEAM";

export interface VipStoreSummary {
  contractorUserId: string;
  storeName: string;
  status: VipGroupStatus;
  groupJid: string | null;
  groupName: string | null;
  lastError: string | null;
  activeMembers: number;
  pendingAdd: number;
  pendingRemove: number;
}

export interface VipStoreGroup {
  id: string;
  contractorUserId: string;
  groupJid: string | null;
  groupName: string;
  status: Exclude<VipGroupStatus, "NONE">;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VipGroupMember {
  id: string;
  groupId: string;
  providerGlobalId: string;
  source: VipMemberSource;
  addedByAdminId: string | null;
  whatsappState: VipMemberWhatsappState;
  lastError: string | null;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
  name: string | null;
  city: string | null;
  /** Completo para VIP_ADMIN/super-admin; `•••• 1234` para os demais. */
  phone: string | null;
}

export interface VipStoreDetail {
  contractorUserId: string;
  storeName: string | null;
  group: VipStoreGroup | null;
  members: VipGroupMember[];
  pendingRemovals: VipGroupMember[];
}

export interface VipProviderSearchItem {
  providerGlobalId: string;
  name: string | null;
  city: string | null;
  phoneMasked: string | null;
}

export interface VipSyncResult {
  attempted: number;
  added: number;
  failed: number;
}

const enc = encodeURIComponent;

export async function getVipGroups(search?: string): Promise<VipStoreSummary[]> {
  const term = search?.trim();
  const res = await api.get("", { params: term ? { search: term } : {} });
  return res.data.data ?? [];
}

export async function searchVipGroupProviders(search: string): Promise<VipProviderSearchItem[]> {
  const res = await api.get("/providers", { params: { search } });
  return res.data.data ?? [];
}

export async function getVipGroupDetail(contractorUserId: string): Promise<VipStoreDetail> {
  const res = await api.get(`/${enc(contractorUserId)}/members`);
  return res.data.data;
}

export async function ensureVipGroup(contractorUserId: string): Promise<VipStoreGroup> {
  const res = await api.post(`/${enc(contractorUserId)}/ensure`);
  return res.data.data;
}

export async function syncVipGroup(contractorUserId: string): Promise<VipSyncResult> {
  const res = await api.post(`/${enc(contractorUserId)}/sync`);
  return res.data.data;
}

export async function addVipGroupMember(contractorUserId: string, providerGlobalId: string): Promise<VipGroupMember> {
  const res = await api.post(`/${enc(contractorUserId)}/members`, { providerGlobalId });
  return res.data.data;
}

export async function removeVipGroupMember(contractorUserId: string, providerGlobalId: string): Promise<VipGroupMember> {
  const res = await api.delete(`/${enc(contractorUserId)}/members/${enc(providerGlobalId)}`);
  return res.data.data;
}

export async function markVipMemberRemovedOnWhatsapp(
  contractorUserId: string,
  providerGlobalId: string,
): Promise<VipGroupMember> {
  const res = await api.post(`/${enc(contractorUserId)}/members/${enc(providerGlobalId)}/removed-on-whatsapp`);
  return res.data.data;
}

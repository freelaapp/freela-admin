import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import type { AdminPermission, AdminRole } from "@/modules/auth/domain/permissions";

/**
 * Usuários do PAINEL admin (`/v1/admins/panel-users`) — só super-admin acessa.
 * Mesma base/token dos demais endpoints do shared kernel (ver consultants-api).
 */
const panelUsersApi = createAuthedClient("/v1/admins/panel-users");

export interface PanelUser {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: AdminRole | string;
  /** Áreas liberadas. Sempre vazio para SUPER_ADMIN (tem tudo por definição). */
  permissions: string[];
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionOption {
  key: AdminPermission | string;
  label: string;
}

export interface CreatePanelUserPayload {
  name: string;
  email: string;
  phone?: string;
  role?: AdminRole;
  permissions?: string[];
}

export interface UpdatePanelUserPayload {
  name?: string;
  phone?: string;
  role?: AdminRole;
  permissions?: string[];
  isActive?: boolean;
}

export interface PanelUserAccessResult {
  user: PanelUser;
  /** Senha temporária em claro — fallback para repassar se o e-mail não sair. */
  tempPassword: string;
  /** `true` se o e-mail com as credenciais foi enviado com sucesso. */
  emailSent: boolean;
}

export async function getPanelUsers(): Promise<PanelUser[]> {
  const res = await panelUsersApi.get("");
  return res.data.data;
}

/** Catálogo de permissões com rótulos em PT (a API é a fonte da verdade). */
export async function getPanelUserPermissions(): Promise<PermissionOption[]> {
  const res = await panelUsersApi.get("/permissions");
  return res.data.data;
}

export async function createPanelUser(
  payload: CreatePanelUserPayload,
): Promise<PanelUserAccessResult> {
  const res = await panelUsersApi.post("", payload);
  return res.data.data;
}

export async function updatePanelUser(
  id: string,
  payload: UpdatePanelUserPayload,
): Promise<PanelUser> {
  const res = await panelUsersApi.patch(`/${id}`, payload);
  return res.data.data;
}

/**
 * Reenvia o acesso: gera nova senha temporária (trocada no próximo login),
 * derruba a sessão atual e reenvia o e-mail com as credenciais.
 */
export async function resetPanelUserAccess(id: string): Promise<PanelUserAccessResult> {
  const res = await panelUsersApi.post(`/${id}/reset-access`);
  return res.data.data;
}

export default panelUsersApi;

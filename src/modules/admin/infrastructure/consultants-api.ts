import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

// Os endpoints de consultores vivem sob /v1/admins (shared kernel), e não sob a base
// de bares-restaurantes usada por `adminApi`. Mesma env + mesmo esquema de token.
const adminsRootApi = createAuthedClient("/v1/admins");

export interface ConsultantItem {
  id: string;
  name: string;
  code: string;
  city: string | null;
  uf: string | null;
  phone: string | null;
  email: string | null;
  commissionRate: number | null;
  notes: string | null;
  isActive: boolean;
  referralsCount: number;
  /** Exclusão lógica (consultor com indicações). Ausente/nulo = não excluído. */
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** HARD = cadastro apagado (sem indicações); SOFT = exclusão lógica. */
export interface DeleteConsultantResult {
  ok: true;
  mode: "HARD" | "SOFT";
  referralsCount: number;
}

export interface CreateConsultantPayload {
  name: string;
  code?: string;
  city?: string;
  uf?: string;
  phone?: string;
  email?: string;
  commissionRate?: number;
  notes?: string;
}

/**
 * Edição: `null` limpa o campo salvo. O código não entra — é só leitura depois de
 * criado (links `?ref=CÓDIGO` já distribuídos parariam de atribuir indicações).
 */
export interface UpdateConsultantPayload {
  name?: string;
  email?: string;
  city?: string | null;
  uf?: string | null;
  phone?: string | null;
  commissionRate?: number | null;
  notes?: string | null;
  isActive?: boolean;
}

export async function getAdminConsultants(
  options: { includeDeleted?: boolean } = {},
): Promise<ConsultantItem[]> {
  const res = await adminsRootApi.get("/consultants", {
    params: options.includeDeleted ? { includeDeleted: "true" } : undefined,
  });
  return res.data.data;
}

export async function getAdminConsultant(id: string): Promise<ConsultantItem> {
  const res = await adminsRootApi.get(`/consultants/${id}`);
  return res.data.data;
}

export async function createAdminConsultant(
  payload: CreateConsultantPayload,
): Promise<ConsultantItem> {
  const res = await adminsRootApi.post("/consultants", payload);
  return res.data.data;
}

export async function updateAdminConsultant(
  id: string,
  payload: UpdateConsultantPayload,
): Promise<ConsultantItem> {
  const res = await adminsRootApi.patch(`/consultants/${id}`, payload);
  return res.data.data;
}

/**
 * Exclui o consultor. Sem indicações a API apaga (HARD); com indicações faz
 * exclusão lógica (SOFT) — as indicações e a origem continuam.
 */
export async function deleteAdminConsultant(id: string): Promise<DeleteConsultantResult> {
  const res = await adminsRootApi.delete(`/consultants/${id}`);
  const data = res.data?.data ?? {};
  // API anterior a 29/09/2026 só devolvia `{ ok: true }` (e só apagava sem indicações).
  return { ok: true, mode: data.mode === "SOFT" ? "SOFT" : "HARD", referralsCount: data.referralsCount ?? 0 };
}

/** Desfaz a exclusão lógica; volta inativo. */
export async function restoreAdminConsultant(id: string): Promise<ConsultantItem> {
  const res = await adminsRootApi.post(`/consultants/${id}/restore`);
  return res.data.data;
}

export interface ResetConsultantAccessResult {
  consultant: ConsultantItem;
  /** Nova senha temporária em claro (fallback para repassar se o e-mail não sair). */
  tempPassword: string;
  /** `true` se o e-mail de credenciais foi enviado com sucesso. */
  emailSent: boolean;
}

/**
 * Reenvia o acesso do consultor: gera nova senha temporária (trocada no próximo
 * login), invalida a sessão atual e reenvia o e-mail com as credenciais.
 */
export async function resetConsultantAccess(id: string): Promise<ResetConsultantAccessResult> {
  const res = await adminsRootApi.post(`/consultants/${id}/reset-access`);
  return res.data.data;
}

export default adminsRootApi;

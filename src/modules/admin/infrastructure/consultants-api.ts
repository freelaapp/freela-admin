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
  createdAt: string;
  updatedAt: string;
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

export type UpdateConsultantPayload = Partial<CreateConsultantPayload> & {
  isActive?: boolean;
};

export async function getAdminConsultants(): Promise<ConsultantItem[]> {
  const res = await adminsRootApi.get("/consultants");
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

export default adminsRootApi;

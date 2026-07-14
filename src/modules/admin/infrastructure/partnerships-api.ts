import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

// Os endpoints de parcerias vivem sob /v1/admins (shared kernel), e não sob a base
// de bares-restaurantes usada por `adminApi`. Mesma env + mesmo esquema de token.
// Espelha `consultants-api.ts`, sem os campos de auth/comissão do consultor.
const adminsRootApi = createAuthedClient("/v1/admins");

export interface PartnershipItem {
  id: string;
  name: string;
  code: string;
  city: string | null;
  uf: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  referralsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePartnershipPayload {
  name: string;
  code?: string;
  city?: string;
  uf?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

export type UpdatePartnershipPayload = Partial<CreatePartnershipPayload> & {
  isActive?: boolean;
};

interface PartnershipModuleReport {
  vacanciesOpened: number;
  gmvCents: number;
}

export interface PartnershipReport {
  partner: { id: string; name: string; code: string };
  companiesRegistered: number;
  vacanciesOpened: number;
  gmvCents: number;
  byModule: {
    "bars-restaurants": PartnershipModuleReport;
    "home-services": PartnershipModuleReport;
  };
  generatedAt: string;
}

export async function getAdminPartnerships(): Promise<PartnershipItem[]> {
  const res = await adminsRootApi.get("/partnerships");
  return res.data.data;
}

export async function createAdminPartnership(
  payload: CreatePartnershipPayload,
): Promise<PartnershipItem> {
  const res = await adminsRootApi.post("/partnerships", payload);
  return res.data.data;
}

export async function updateAdminPartnership(
  id: string,
  payload: UpdatePartnershipPayload,
): Promise<PartnershipItem> {
  const res = await adminsRootApi.patch(`/partnerships/${id}`, payload);
  return res.data.data;
}

export async function getAdminPartnershipReport(
  id: string,
): Promise<PartnershipReport> {
  const res = await adminsRootApi.get(`/partnerships/${id}/report`);
  return res.data.data;
}

/** Lead capturado num anúncio de parceria (clique logado ou formulário da home). */
export interface PartnerAdLeadItem {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  /** false = lead "sem cadastro" (ainda não vinculado a uma conta). */
  registered: boolean;
  source: string;
  clicksCount: number;
  advertisementTitle: string | null;
  firstClickedAt: string;
  lastClickedAt: string;
}

export interface PartnerAdLeadsReport {
  partner: { id: string; name: string; code: string };
  total: number;
  leads: PartnerAdLeadItem[];
}

export async function getAdminPartnershipAdLeads(
  id: string,
): Promise<PartnerAdLeadsReport> {
  const res = await adminsRootApi.get(`/partnerships/${id}/ad-leads`);
  return res.data.data;
}

export default adminsRootApi;

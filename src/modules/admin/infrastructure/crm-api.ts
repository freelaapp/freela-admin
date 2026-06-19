import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const crmApi = createAuthedClient("/v1/admin/crm");

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type CrmCompanyStatus = "NOVO" | "EM_CONTATO" | "NEGOCIANDO" | "FECHADO" | "PERDIDO";
export type CrmPriority = "ALTA" | "MEDIA" | "BAIXA";

export interface CrmCompanyCard {
  id: string;
  name: string;
  status: CrmCompanyStatus;
  priority: CrmPriority;
  segment: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  linkedContractorUserId: string | null;
  assignedAdminId: string | null;
  boardOrder: number;
  openTasksCount: number;
  contactsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrmContact {
  id: string;
  companyId: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
}

export interface CrmTask {
  id: string;
  companyId: string | null;
  title: string;
  priority: CrmPriority;
  dueAt: string | null;
  done: boolean;
  doneAt: string | null;
  ownerAdminId: string | null;
  createdAt: string;
  company?: { id: string; name: string } | null;
}

export interface CrmNote {
  id: string;
  companyId: string;
  adminId: string | null;
  body: string;
  createdAt: string;
}

export interface CrmCompanyDetail extends CrmCompanyCard {
  contacts: CrmContact[];
  tasks: CrmTask[];
  crmNotes: CrmNote[];
}

export interface ContractorSearchResult {
  userId: string;
  name: string;
  city: string | null;
  module: string;
}

export interface CreateCompanyInput {
  name: string;
  status?: CrmCompanyStatus;
  priority?: CrmPriority;
  segment?: string;
  city?: string;
  phone?: string;
  email?: string;
  notes?: string;
  linkedContractorUserId?: string;
}
export type UpdateCompanyInput = Partial<Omit<CreateCompanyInput, "linkedContractorUserId">>;

export interface CreateTaskInput {
  title: string;
  companyId?: string;
  priority?: CrmPriority;
  dueAt?: string;
}
export interface UpdateTaskInput {
  title?: string;
  priority?: CrmPriority;
  dueAt?: string | null;
  done?: boolean;
}

export interface CreateContactInput {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
}

// ─── Companies ──────────────────────────────────────────────────────────────

export async function listCrmCompanies(params?: {
  status?: CrmCompanyStatus;
  priority?: CrmPriority;
  q?: string;
}): Promise<CrmCompanyCard[]> {
  const res = await crmApi.get("/companies", { params });
  return res.data.data;
}

export async function getCrmCompany(id: string): Promise<CrmCompanyDetail> {
  const res = await crmApi.get(`/companies/${id}`);
  return res.data.data;
}

export async function createCrmCompany(dto: CreateCompanyInput): Promise<CrmCompanyCard> {
  const res = await crmApi.post("/companies", dto);
  return res.data.data;
}

export async function updateCrmCompany(id: string, dto: UpdateCompanyInput): Promise<CrmCompanyCard> {
  const res = await crmApi.patch(`/companies/${id}`, dto);
  return res.data.data;
}

export async function moveCrmCompany(
  id: string,
  status: CrmCompanyStatus,
  boardOrder?: number,
): Promise<CrmCompanyCard> {
  const res = await crmApi.patch(`/companies/${id}/move`, { status, boardOrder });
  return res.data.data;
}

export async function deleteCrmCompany(id: string): Promise<void> {
  await crmApi.delete(`/companies/${id}`);
}

// ─── Contacts ─────────────────────────────────────────────────────────────

export async function addCrmContact(companyId: string, dto: CreateContactInput): Promise<CrmContact> {
  const res = await crmApi.post(`/companies/${companyId}/contacts`, dto);
  return res.data.data;
}
export async function deleteCrmContact(id: string): Promise<void> {
  await crmApi.delete(`/contacts/${id}`);
}

// ─── Tasks ────────────────────────────────────────────────────────────────

export async function listCrmTasks(params?: {
  done?: boolean;
  priority?: CrmPriority;
  companyId?: string;
}): Promise<CrmTask[]> {
  const res = await crmApi.get("/tasks", { params });
  return res.data.data;
}
export async function createCrmTask(dto: CreateTaskInput): Promise<CrmTask> {
  const res = await crmApi.post("/tasks", dto);
  return res.data.data;
}
export async function updateCrmTask(id: string, dto: UpdateTaskInput): Promise<CrmTask> {
  const res = await crmApi.patch(`/tasks/${id}`, dto);
  return res.data.data;
}
export async function deleteCrmTask(id: string): Promise<void> {
  await crmApi.delete(`/tasks/${id}`);
}

// ─── Notes ────────────────────────────────────────────────────────────────

export async function addCrmNote(companyId: string, body: string): Promise<CrmNote> {
  const res = await crmApi.post(`/companies/${companyId}/notes`, { body });
  return res.data.data;
}
export async function deleteCrmNote(id: string): Promise<void> {
  await crmApi.delete(`/notes/${id}`);
}

// ─── Buscar contratante já cadastrado ─────────────────────────────────────

export async function searchCrmContractors(q: string): Promise<ContractorSearchResult[]> {
  const res = await crmApi.get("/contractors/search", { params: { q } });
  return res.data.data;
}

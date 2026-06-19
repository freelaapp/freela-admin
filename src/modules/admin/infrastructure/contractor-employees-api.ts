import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const contractorEmployeesApi = createAuthedClient("/v1/admin");

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface ContractorEmployeeView {
  id: string;
  ownerUserId: string;
  employeeUserId: string;
  label: string | null;
  loginEmail: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateContractorEmployeeInput {
  loginEmail: string;
  password: string;
  label?: string;
}

export interface UpdateContractorEmployeeInput {
  isActive?: boolean;
  label?: string;
}

// ─── Funções ────────────────────────────────────────────────────────────────

export async function getContractorEmployee(
  ownerUserId: string,
): Promise<ContractorEmployeeView | null> {
  const res = await contractorEmployeesApi.get(
    `/contractors/${ownerUserId}/employee`,
  );
  return res.data.data;
}

export async function createContractorEmployee(
  ownerUserId: string,
  dto: CreateContractorEmployeeInput,
): Promise<ContractorEmployeeView> {
  const res = await contractorEmployeesApi.post(
    `/contractors/${ownerUserId}/employee`,
    dto,
  );
  return res.data.data;
}

export async function updateContractorEmployee(
  ownerUserId: string,
  dto: UpdateContractorEmployeeInput,
): Promise<ContractorEmployeeView> {
  const res = await contractorEmployeesApi.patch(
    `/contractors/${ownerUserId}/employee`,
    dto,
  );
  return res.data.data;
}

export async function rotateContractorEmployeePassword(
  ownerUserId: string,
  password: string,
): Promise<{ ok: true }> {
  const res = await contractorEmployeesApi.post(
    `/contractors/${ownerUserId}/employee/rotate-password`,
    { password },
  );
  return res.data.data;
}

export async function removeContractorEmployee(
  ownerUserId: string,
): Promise<{ ok: true }> {
  const res = await contractorEmployeesApi.delete(
    `/contractors/${ownerUserId}/employee`,
  );
  return res.data.data;
}

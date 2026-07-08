import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

// Vagas Fixas (FixedJobPost) — listagem admin sob /v1/fixed-jobs/admin.
const fixedJobsAdminApi = createAuthedClient("/v1/fixed-jobs/admin");

export interface FixedJobItem {
  id: string;
  contractorUserId: string;
  title: string;
  role: string;
  category: string | null;
  companyName: string;
  location: string;
  status: string;
  salaryMinInCents: number | null;
  salaryMaxInCents: number | null;
  closeReason: string | null;
  closedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  applicationCount: number;
  /** Consultor que indicou o contratante desta vaga (null quando não indicado). */
  referringConsultant?: { id: string; name: string; code: string } | null;
}

export async function getAdminFixedJobs(consultantId?: string): Promise<FixedJobItem[]> {
  const res = await fixedJobsAdminApi.get("/posts", {
    params: consultantId ? { consultantId } : undefined,
  });
  return res.data.data;
}

/** Um dia de jornada da vaga fixa (dia da semana + horário início/fim). */
export interface FixedJobWorkScheduleSlot {
  day: string;
  start: string;
  end: string;
}

/**
 * Payload para o admin criar uma vaga fixa/CLT em nome de um contratante.
 * Espelha o formulário do contratante no site + `contractorUserId` (o dono da vaga).
 * Enviado para `POST /v1/fixed-jobs/admin/posts`.
 */
export interface CreateAdminFixedJobPayload {
  contractorUserId: string;
  title: string;
  role: string;
  category?: string;
  companyName: string;
  description: string;
  location: string;
  salaryProposalInCents?: number;
  workSchedule?: string;
  workScheduleSlots?: FixedJobWorkScheduleSlot[];
  benefits?: string;
  contactEmail?: string;
  contactPhone?: string;
  applicationInstructions?: string;
}

export async function createAdminFixedJob(
  payload: CreateAdminFixedJobPayload,
): Promise<FixedJobItem> {
  const res = await fixedJobsAdminApi.post("/posts", payload);
  return res.data.data;
}

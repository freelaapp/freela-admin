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
  /** Proposta salarial única — o campo que os fluxos de criação realmente
   * preenchem (min/max ficam nulos). Opcional durante deploy da API. */
  salaryProposalInCents?: number | null;
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

// ---------------------------------------------------------------------------
// Candidaturas de vagas fixas (viewer de candidatos no admin)
// ---------------------------------------------------------------------------

/** Status de uma candidatura de vaga fixa. `ACTIVE` = em consideração; `REJECTED` = negada. */
export type FixedJobApplicationStatus = "ACTIVE" | "REJECTED";

/**
 * Currículo profissional preenchido pelo freelancer (JSON livre). Espelha o
 * shape lido pelo `FreelancerCurriculumReadonly` do web. Todos os campos são
 * opcionais — o renderer ignora entradas vazias.
 */
export interface FixedJobProfessionalCurriculum {
  experiences?: Array<{ workplace?: string; role?: string; durationLabel?: string }>;
  courses?: Array<{ title?: string; durationLabel?: string; completionYear?: number | string }>;
  skills?: string;
  competitiveEdge?: string;
}

/** Perfil global do provider anexado à candidatura (null quando `providerGlobalId` é null). */
export interface FixedJobApplicationProvider {
  avatarUrl: string | null;
  presentationVideoUrl: string | null;
  professionalCurriculum: FixedJobProfessionalCurriculum | null;
}

/** Uma candidatura a uma vaga fixa, na visão do admin. */
export interface FixedJobAdminApplication {
  id: string;
  fixedJobPostId: string;
  providerUserId: string;
  providerGlobalId: string | null;
  applicantName: string;
  applicantEmail: string | null;
  applicantPhone: string | null;
  message: string | null;
  curriculumSnapshot: FixedJobProfessionalCurriculum | null;
  curriculumPdfUrl: string | null;
  curriculumPdfName: string | null;
  status: FixedJobApplicationStatus;
  rejectedAt: string | null;
  createdAt: string;
  provider: FixedJobApplicationProvider | null;
}

/** Candidaturas de uma vaga fixa (ordenadas por `createdAt` desc). */
export async function getFixedJobApplications(
  postId: string,
): Promise<FixedJobAdminApplication[]> {
  const res = await fixedJobsAdminApi.get(`/posts/${postId}/applications`);
  return res.data.data;
}

/** Atualiza o status de uma candidatura (ACTIVE ⇄ REJECTED). */
export async function setFixedJobApplicationStatus(
  applicationId: string,
  status: FixedJobApplicationStatus,
): Promise<FixedJobAdminApplication> {
  const res = await fixedJobsAdminApi.patch(`/applications/${applicationId}/status`, {
    status,
  });
  return res.data.data;
}

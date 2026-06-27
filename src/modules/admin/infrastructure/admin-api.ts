import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const adminApi = createAuthedClient("/v1/bars-restaurants/admin");

// ─── Metrics ────────────────────────────────────────────────────────────────

export interface AdminMetrics {
  totalFreelancers: number;
  activeFreelancers: number;
  newFreelancersThisMonth: number;
  freelancersByRole: { role: string; count: number }[];
  totalCompanies: number;
  activeCompanies: number;
  newCompaniesThisMonth: number;
  topCompanies: { id: string; name: string; jobCount: number }[];
  openVacancies: number;
  closedVacancies: number;
  cancelledVacancies: number;
  scheduledJobs: number;
  inProgressJobs: number;
  completedJobs: number;
  cancelledJobs: number;
  jobsByCity: { city: string; count: number }[];
  jobsByMonth: { month: string; count: number }[];
  pendingCandidacies: number;
  acceptedCandidacies: number;
  rejectedCandidacies: number;
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  totalFeedbacks: number;
  averageRating: number | null;
  totalRevenue: number;
  pendingRepasses: number;
  completedRepasses: number;
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const res = await adminApi.get("/metrics");
  return res.data.data;
}

// ─── Contractors (Empresas) ─────────────────────────────────────────────────

export interface ContractorItem {
  id: string;
  userId: string;
  companyName: string | null;
  contactName: string;
  contactEmail: string | null;
  registrationEmail: string | null;
  contactPhone: string;
  city: string;
  uf: string;
  segment: string | null;
  cnpj: string | null;
  cpf: string | null;
  isActive: boolean;
  createdAt: string;
  jobs: number;
  ticketMedio: number | null;
  avaliacao: number | null;
  referredByConsultant?: { id: string; name: string; code: string } | null;
}

export async function getAdminContractors(): Promise<ContractorItem[]> {
  const res = await adminApi.get("/contractors");
  return res.data.data;
}

export async function updateAdminContractor(
  id: string,
  payload: { companyName?: string; segment?: string },
): Promise<ContractorItem> {
  const res = await adminApi.patch(`/contractors/${id}`, payload);
  return res.data.data;
}

// ─── Relatório do contratante (vagas + freelancers) ──────────────────────────

export interface ContractorReportHeader {
  id: string;
  companyName: string | null;
  cnpj: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  city: string | null;
  uf: string | null;
  createdAt: string;
}

export interface ContractorReportRepasse {
  amount: number;
  status: string;
  pixKey: string | null;
  pixKeyType: string | null;
  confirmedAt: string | null;
}

export interface ContractorReportRow {
  vacancy_id: string;
  title: string | null;
  vacancy_service: string | null;
  vacancy_status: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  base_amount_in_cents: number | null;
  freelancer_amount_in_cents: number | null;
  platform_fee_in_cents: number | null;
  provides_meal: boolean | null;
  contractor_payment: { status: string; value: number } | string | null;
  candidacy_id: string | null;
  candidacy_status: string | null;
  freelancer_name: string | null;
  freelancer_email: string | null;
  freelancer_phone: string | null;
  freelancer_cpf_casa: string | null;
  candidacy_role: string | null;
  repasse: ContractorReportRepasse | string | null;
}

export interface ContractorReportResult {
  contractor: ContractorReportHeader;
  range: { from: string | null; to: string | null };
  rows: ContractorReportRow[];
}

export async function getContractorReport(
  id: string,
  from?: string,
  to?: string,
): Promise<ContractorReportResult> {
  const res = await adminApi.get(`/contractors/${id}/report`, { params: { from, to } });
  return res.data.data;
}

// ─── Providers (Freelancers) ────────────────────────────────────────────────

export interface ProviderItem {
  id: string;
  userId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  jobTitle: string | null;
  services: string[];
  bio: string | null;
  city: string | null;
  uf: string | null;
  isActive: boolean;
  createdAt: string;
  trabalhos: number;
  avaliacao: number | null;
  score: number;
}

export interface GetAdminProvidersParams {
  page?: number;
  limit?: number;
  search?: string;
  uf?: string;
  city?: string;
  service?: string;
  status?: "active" | "inactive";
}

export interface PagedProviders {
  data: ProviderItem[];
  total: number;
  page: number;
  limit: number;
}

export async function getAdminProviders(
  params: GetAdminProvidersParams = {},
): Promise<PagedProviders> {
  const res = await adminApi.get("/providers", { params });
  const total = res.data.meta?.total ?? res.data.data?.length ?? 0;
  const page = res.data.meta?.page ?? params.page ?? 1;
  const limit = res.data.meta?.limit ?? params.limit ?? 100;
  return { data: res.data.data, total, page, limit };
}

export interface ProvidersFilterOptions {
  ufs: string[];
  cities: string[];
  services: string[];
}

export async function getProvidersFilterOptions(): Promise<ProvidersFilterOptions> {
  const res = await adminApi.get("/providers/filter-options");
  return res.data.data;
}

// ─── Vacancies (Jobs/Vagas) ─────────────────────────────────────────────────

export interface VacancyItem {
  id: string;
  contractorId: string;
  title: string;
  description: string | null;
  serviceType: string;
  date: string;
  startTime: string;
  endTime: string;
  payment: number;
  address: string | null;
  cityId: string | null;
  status: string;
  createdAt: string;
  contractorName?: string | null;
  contractorCompanyName?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  providerPhone?: string | null;
  providerEmail?: string | null;
  providerPixKeys?: ProviderPixKey[];
  freelancerAmountInCents?: number | null;
  platformFeeInCents?: number | null;
  /** Quantidade de freelancers que se candidataram à vaga. */
  candidacyCount?: number;
  /**
   * Job vinculado à vaga (presente apenas quando há job criado — pós-pagamento).
   * Backend retorna apenas no endpoint /closed-vacancies.
   */
  job?: {
    id: string;
    status: string;
    hasContractorFeedback?: boolean;
    hasProviderFeedback?: boolean;
  } | null;
  /** Consultor que indicou o contratante desta vaga (null quando não indicado). */
  referringConsultant?: { id: string; name: string; code: string } | null;
}

export interface ProviderPixKey {
  keyType: string;
  keyValue: string;
  isDefault: boolean;
}

export async function getAdminOpenVacancies(consultantId?: string): Promise<VacancyItem[]> {
  const res = await adminApi.get("/open-vacancies", {
    params: consultantId ? { consultantId } : undefined,
  });
  return res.data.data;
}

export async function getAdminClosedVacancies(consultantId?: string): Promise<VacancyItem[]> {
  const res = await adminApi.get("/closed-vacancies", {
    params: consultantId ? { consultantId } : undefined,
  });
  return res.data.data;
}

export interface VacancyCandidacyItem {
  id: string;
  providerId: string;
  providerName: string | null;
  providerPhone: string | null;
  providerEmail: string | null;
  status: string;
  createdAt: string;
}

export async function getVacancyCandidacies(vacancyId: string): Promise<VacancyCandidacyItem[]> {
  const res = await adminApi.get(`/vacancies/${vacancyId}/candidacies`);
  return res.data.data;
}

export interface VacancyFeedbackEntry {
  rating: number;
  comment: string | null;
  createdAt: string;
  authorName: string | null;
}

export interface VacancyFeedbacksResponse {
  jobId: string | null;
  jobStatus: string | null;
  /** Avaliação do contratante sobre o freelancer. */
  contractor: VacancyFeedbackEntry | null;
  /** Avaliação do freelancer sobre o contratante. */
  provider: VacancyFeedbackEntry | null;
}

export async function getVacancyFeedbacks(
  vacancyId: string,
): Promise<VacancyFeedbacksResponse> {
  const res = await adminApi.get(`/vacancies/${vacancyId}/feedbacks`);
  return res.data.data;
}

export interface AdminCancelVacancyResult {
  vacancyId: string;
  refundAmount: number;
  refundType: "FULL" | "PARTIAL_50" | "NONE";
  cancelledCandidacies: number;
}

export async function adminCancelVacancy(
  vacancyId: string,
  reason: string,
): Promise<AdminCancelVacancyResult> {
  const res = await adminApi.post(`/vacancies/${vacancyId}/cancel`, { reason });
  return res.data.data;
}

export interface AdminRestartVacancyResult {
  vacancyId: string;
  reopened: boolean;
  /** O valor pago NÃO é estornado — fica retido para o freelancer substituto. */
  retainedPayment: boolean;
  cancelledCandidacies: number;
  restoredCandidacies: number;
  jobReset: boolean;
  checkinsCleared: number;
}

/** Reabre a vaga do zero (no-show): tira o aceito, reseta job/check-ins, mantém o valor. */
export async function adminRestartVacancy(
  vacancyId: string,
  reason: string,
): Promise<AdminRestartVacancyResult> {
  const res = await adminApi.post(`/vacancies/${vacancyId}/restart`, { reason });
  return res.data.data;
}

/** Banir (definitivo) ou desbanir um freelancer pelo userId. Bloqueia/libera o login. */
export async function adminSetFreelancerBanned(
  userId: string,
  banned: boolean,
): Promise<{ userId: string; banned: boolean }> {
  const res = await adminApi.post(`/providers/${userId}/${banned ? "ban" : "unban"}`);
  return res.data.data;
}

export interface AdminRemoveCandidacyResult {
  vacancyId: string;
  candidacyId: string;
  providerId: string;
  vacancyReopened: boolean;
}

export async function adminRemoveCandidacy(
  vacancyId: string,
  candidacyId: string,
  reason?: string,
): Promise<AdminRemoveCandidacyResult> {
  const res = await adminApi.post(
    `/vacancies/${vacancyId}/candidacies/${candidacyId}/remove`,
    reason ? { reason } : {},
  );
  return res.data.data;
}

export async function getAdminAllVacancies(consultantId?: string): Promise<VacancyItem[]> {
  const [open, closed] = await Promise.all([
    getAdminOpenVacancies(consultantId),
    getAdminClosedVacancies(consultantId),
  ]);
  return [...open, ...closed];
}

// ─── Users ──────────────────────────────────────────────────────────────────

export interface UserItem {
  id: string;
  email: string;
  isActive: boolean;
  emailConfirmed: boolean;
  status: string;
  deletionFeedback: string | null;
  deletionRequestedAt: string | null;
  deletionScheduledAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export async function getAdminUsers(): Promise<UserItem[]> {
  const res = await adminApi.get("/users");
  return res.data.data;
}

export interface DeletionStats {
  totalDeleted: number;
  pendingDeletion: number;
  suspendedDeletion: number;
  deletedThisMonth: number;
  feedbackBreakdown: { reason: string; count: number }[];
  deletionsByMonth: { month: string; count: number }[];
}

export async function getAdminDeletionStats(): Promise<DeletionStats> {
  const res = await adminApi.get("/deletion-stats");
  return res.data.data;
}

// ─── Feedbacks ──────────────────────────────────────────────────────────────

export interface FeedbackItem {
  id: string;
  jobId: string;
  authorId: string;
  role: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  authorName: string | null;
  jobTitle: string | null;
}

export async function getAdminFeedbacks(): Promise<FeedbackItem[]> {
  const res = await adminApi.get("/feedbacks");
  return res.data.data;
}

// ─── Financials ─────────────────────────────────────────────────────────────

export interface PaymentItem {
  id: string;
  status: string;
  value: number;
  serviceAmountInCents: number;
  correlationId: string;
  paymentLinkUrl: string | null;
  createdAt: string;
}

export async function getAdminPayments(): Promise<PaymentItem[]> {
  const res = await adminApi.get("/payments");
  return res.data.data;
}

export interface RepasseItem {
  id: string;
  vacancyId: string;
  jobId: string;
  providerGlobalId: string;
  pixKey: string;
  pixKeyType: string;
  amountInCents: number;
  status: string;
  confirmedAt: string | null;
  createdAt: string;
}

export async function getAdminRepasses(): Promise<RepasseItem[]> {
  const res = await adminApi.get("/repasses");
  return res.data.data;
}

// ─── Provider Job History ──────────────────────────────────────────────────────

export interface ProviderHistoryItem {
  vacancyId: string;
  title: string;
  date: string;
  payment: number;
  status: string;
  rating: number | null;
  comment: string | null;
  authorName: string | null;
}

export async function getProviderHistory(providerId: string): Promise<ProviderHistoryItem[]> {
  const res = await adminApi.get(`/providers/${providerId}/history`);
  return res.data.data;
}

// ─── Hard delete (permanent, irreversible) ───────────────────────────────────

/** Tipo de conta — define a redação da notificação de exclusão (empresa vs freelancer). */
export type HardDeleteAccountType = "contractor" | "freelancer";

/**
 * Permanently deletes a user (hard delete). Hits the global admin route, not the
 * bars-restaurants-scoped base — so we pass an absolute URL to override baseURL
 * while still going through the auth interceptor.
 * `accountType` tailors the user-facing notification (company vs freelancer).
 * Backend returns 422 when blocked (active job / pending payment / pending repasse).
 */
export async function adminHardDeleteUser(
  userId: string,
  reason: string,
  accountType?: HardDeleteAccountType,
): Promise<void> {
  await adminApi.delete(`${API_BASE_URL}/v1/admin/users/${userId}/hard-delete`, {
    data: { reason, ...(accountType ? { accountType } : {}) },
  });
}

export default adminApi;

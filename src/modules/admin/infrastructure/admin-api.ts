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
  /** Listas completas (sempre, ignora o filtro ativo) para popular os dropdowns. */
  filterOptions: { cities: string[]; roles: string[] };
}

export interface AdminMetricsParams {
  /** Cidade da vaga (BRVacancy.cityId — nome da cidade). */
  city?: string;
  /** Cargo/função da vaga (BRVacancy.serviceType). */
  role?: string;
}

export async function getAdminMetrics(params?: AdminMetricsParams): Promise<AdminMetrics> {
  const res = await adminApi.get("/metrics", {
    params: {
      ...(params?.city ? { city: params.city } : {}),
      ...(params?.role ? { role: params.role } : {}),
    },
  });
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
  referredByPartnership?: { id: string; name: string; code: string } | null;
}

/**
 * Formata a origem de um cadastro (Normal / Consultor / Parceria) a partir dos
 * campos de referral anotados pelo backend. Parceria e Consultor são independentes:
 * se ambos existirem, mostra os dois. Sem nenhum → "—".
 */
export function formatReferralOrigin(source: {
  referredByPartnership?: { name: string; code?: string } | null;
  referredByConsultant?: { name: string; code?: string } | null;
}): string {
  const parts: string[] = [];
  if (source.referredByPartnership) {
    const { name, code } = source.referredByPartnership;
    parts.push(`Parceria: ${name}${code ? ` (${code})` : ""}`);
  }
  if (source.referredByConsultant) {
    const { name, code } = source.referredByConsultant;
    parts.push(`Consultor: ${name}${code ? ` (${code})` : ""}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
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
  /**
   * Lista de baixa prioridade (avaliação < 3⭐ de contratante): candidaturas
   * dele aparecem por último pro contratante. Ausente/undefined = prioridade normal
   * (compatível com API anterior ao deploy do campo).
   */
  lowPriority?: boolean;
  /** Desde quando está em baixa prioridade (ISO), quando `lowPriority` = true. */
  lowPrioritySince?: string | null;
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
  /**
   * Horários de cada etapa da linha do tempo (ISO). Presente nas vagas fechadas;
   * ausente nas abertas (que ainda não têm job). Campo nulo = evento não ocorreu.
   */
  timeline?: {
    createdAt: string;
    firstCandidacyAt: string | null;
    hiredAt: string | null;
    scheduledAt: string | null;
    startedAt: string | null;
    endedAt: string | null;
    reviewedAt: string | null;
  };
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

/**
 * Tipo de estorno escolhido pelo admin ao cancelar a vaga:
 * - `FULL`: devolve tudo (menos a taxa Pix).
 * - `PARTIAL_50`: devolve metade.
 * - `NONE`: sem estorno.
 * Quando omitido, o backend aplica a regra legada por tempo.
 */
export type RefundType = "FULL" | "PARTIAL_50" | "NONE";

export interface AdminCancelVacancyResult {
  vacancyId: string;
  refundAmount: number;
  refundType: RefundType;
  cancelledCandidacies: number;
}

export async function adminCancelVacancy(
  vacancyId: string,
  reason: string,
  refundType?: RefundType,
): Promise<AdminCancelVacancyResult> {
  const res = await adminApi.post(`/vacancies/${vacancyId}/cancel`, {
    reason,
    ...(refundType ? { refundType } : {}),
  });
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

/**
 * Restaura a prioridade normal do freelancer (remove da lista de baixa
 * prioridade). Mesma resolução de id do ban (userId). Retorna 204.
 */
export async function clearProviderLowPriority(id: string): Promise<void> {
  await adminApi.delete(`/providers/${id}/low-priority`);
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
  referredByConsultant?: { id: string; name: string; code: string } | null;
  referredByPartnership?: { id: string; name: string; code: string } | null;
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
  // Perfil do avaliador — campos aditivos; podem estar ausentes antes do deploy da API
  authorEmail?: string | null;
  authorPhone?: string | null;
  authorAvatarUrl?: string | null;
  authorCompanyName?: string | null;
  authorCity?: string | null;
  authorUf?: string | null;
  authorJobTitle?: string | null;
  // Perfil do AVALIADO (outra ponta do job) — campos aditivos; podem estar ausentes antes do deploy da API
  targetUserId?: string | null;
  targetName?: string | null;
  targetEmail?: string | null;
  targetPhone?: string | null;
  targetAvatarUrl?: string | null;
  targetCompanyName?: string | null;
  targetCity?: string | null;
  targetUf?: string | null;
  targetJobTitle?: string | null;
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

// ─── Dashboard financeiro (saldo ao vivo + fluxo) ────────────────────────────

/**
 * Resumo financeiro (centavos). Saldos vêm AO VIVO dos gateways (Woovi + Asaas);
 * `null` = indisponível no momento (fail-open, não quebra o painel). O resto é
 * calculado do nosso banco, cross-módulo, filtrado pelo período.
 */
export interface FinanceSummary {
  saldoWooviCents: number | null;
  saldoAsaasCents: number | null;
  saldoTotalCents: number | null;
  entradasCents: number;
  saidasCents: number;
  estornosCents: number;
  /** Taxa da plataforma das vagas pagas − taxa de gateway − bônus pagos. */
  lucroCents: number;
  gatewayFeesCents: number;
  entradasCount: number;
  saidasCount: number;
  estornosCount: number;
}

export interface FinanceTransaction {
  id: string;
  type: "entrada" | "saida" | "estorno";
  /** charge | repasse | bonus | refund_admin_br | refund_admin_casa | refund_cancel */
  kind: string;
  amountInCents: number;
  status: string;
  provider: string | null;
  method: string | null;
  vacancyId: string | null;
  reference: string | null;
  createdAt: string;
}

export interface FinancePeriodParams {
  /** Dia local (YYYY-MM-DD). Vazio/omitido = sem limite inferior. */
  from?: string;
  /** Dia local (YYYY-MM-DD), inclusivo. Vazio/omitido = sem limite superior. */
  to?: string;
}

export interface FinanceTransactionParams extends FinancePeriodParams {
  type?: "entrada" | "saida" | "estorno";
  provider?: string;
  vacancyId?: string;
}

/**
 * Converte um dia local (YYYY-MM-DD) nos extremos do dia em Brasília (UTC-3),
 * pro filtro de data ser inclusivo do dia inteiro escolhido (o backend faz
 * `new Date(...)`, então mandamos o instante ISO com offset explícito).
 */
function toRangeParams(p: FinancePeriodParams): Record<string, string> {
  return {
    ...(p.from ? { from: `${p.from}T00:00:00.000-03:00` } : {}),
    ...(p.to ? { to: `${p.to}T23:59:59.999-03:00` } : {}),
  };
}

export async function getFinanceSummary(
  params: FinancePeriodParams = {},
): Promise<FinanceSummary> {
  const res = await adminApi.get("/finance/summary", { params: toRangeParams(params) });
  return res.data.data;
}

export async function getFinanceTransactions(
  params: FinanceTransactionParams = {},
): Promise<{ items: FinanceTransaction[]; truncated: boolean }> {
  const res = await adminApi.get("/finance/transactions", {
    params: {
      ...toRangeParams(params),
      ...(params.type ? { type: params.type } : {}),
      ...(params.provider ? { provider: params.provider } : {}),
      ...(params.vacancyId ? { vacancyId: params.vacancyId } : {}),
    },
  });
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
  // Perfil do avaliador (sempre contratante) — campos aditivos; podem estar ausentes antes do deploy da API
  authorId?: string | null;
  authorEmail?: string | null;
  authorPhone?: string | null;
  authorAvatarUrl?: string | null;
  authorCompanyName?: string | null;
  authorCity?: string | null;
  authorUf?: string | null;
  authorJobTitle?: string | null;
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

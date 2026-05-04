import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const adminApi = axios.create({
  baseURL: `${API_BASE_URL}/v1/bars-restaurants/admin`,
  headers: {
    "Content-Type": "application/json",
  },
});

adminApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("authUser");
    if (stored) {
      try {
        const user = JSON.parse(stored);
        if (user.accessToken) {
          config.headers.Authorization = `Bearer ${user.accessToken}`;
        }
      } catch {
        // ignore
      }
    }
  }
  return config;
});

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
}

export async function getAdminContractors(): Promise<ContractorItem[]> {
  const res = await adminApi.get("/contractors");
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
  bio: string | null;
  city: string | null;
  uf: string | null;
  isActive: boolean;
  createdAt: string;
  trabalhos: number;
  avaliacao: number | null;
  score: number;
}

export async function getAdminProviders(): Promise<ProviderItem[]> {
  const res = await adminApi.get("/providers");
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
  providerName?: string | null;
}

export async function getAdminOpenVacancies(): Promise<VacancyItem[]> {
  const res = await adminApi.get("/open-vacancies");
  return res.data.data;
}

export async function getAdminClosedVacancies(): Promise<VacancyItem[]> {
  const res = await adminApi.get("/closed-vacancies");
  return res.data.data;
}

export async function getAdminAllVacancies(): Promise<VacancyItem[]> {
  const [open, closed] = await Promise.all([
    getAdminOpenVacancies(),
    getAdminClosedVacancies(),
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

export default adminApi;

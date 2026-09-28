export interface ConsultantSession {
  email: string;
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

export type RegistrationPersona = "provider" | "contractor";
export type RegistrationModule = "bars-restaurants" | "home-services" | "freela-em-casa";

export interface CreateRegistrationPayload {
  persona: RegistrationPersona;
  module?: RegistrationModule;
  name: string;
  phone: string;
  email?: string;
  cityId?: string;
}

export type RegistrationSource = "LINK" | "ON_BEHALF";
export type RegistrationTypeFilter = "all" | "freelancer" | "contractor";

export interface RegistrationItem {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** Perfil de HOJE (`provider` | `contractor`); `null` = ainda sem perfil. */
  persona: string | null;
  /** `bars-restaurants` (Empresa) ou `home-services` (Casa) — só contratante. */
  module: string | null;
  companyName: string | null;
  city: string | null;
  uf: string | null;
  source: RegistrationSource | null;
  /** Contratante que já publicou vaga. */
  hasVacancy: boolean;
  status: "pending" | "active";
  createdAt: string;
}

export interface RegistrationFilters {
  type: RegistrationTypeFilter;
  q: string;
  page: number;
  pageSize: number;
}

export interface RegistrationPage {
  total: number;
  page: number;
  pageSize: number;
  items: RegistrationItem[];
}

export interface ConsultantTotals {
  registrations: number;
  freelancers: number;
  contractors: number;
  contractorsWithVacancy: number;
}

export interface ConsultantProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  code: string;
  city: string | null;
  uf: string | null;
  referralLink: string;
  commissionRate: number | null;
  totals: ConsultantTotals;
}

/** O consultor edita só nome e telefone (telefone em E.164). */
export interface UpdateConsultantProfilePayload {
  name?: string;
  phone?: string;
}

/** Produto a que a vaga pertence (define o endpoint consultor-scoped consultado). */
export type VacancyModule = "bars-restaurants" | "home-services";

/** Job vinculado a uma vaga fechada — só presente em BR (Casa não expõe). */
export interface ConsultantVacancyJob {
  id: string;
  status: string;
  hasContractorFeedback?: boolean;
  hasProviderFeedback?: boolean;
}

/**
 * Vaga de um contratante indicado pelo consultor, normalizada entre os dois produtos.
 * Campos opcionais (`candidacyCount`, `provider*`, `job`) só vêm de BR — Casa expõe
 * apenas os dados básicos da vaga.
 */
export interface ConsultantVacancy {
  id: string;
  module: VacancyModule;
  title: string;
  serviceType: string;
  /** `YYYY-MM-DD` (data pura da vaga). */
  date: string;
  startTime: string;
  endTime: string;
  /** Valor em centavos. */
  payment: number;
  status: string;
  createdAt: string;
  contractorName: string | null;
  contractorCompanyName: string | null;
  candidacyCount?: number;
  providerName?: string | null;
  providerPhone?: string | null;
  job?: ConsultantVacancyJob | null;
}

/** Freelancer que se candidatou a uma vaga (detalhe — disponível só para BR). */
export interface ConsultantVacancyCandidacy {
  id: string;
  providerId: string;
  providerName: string | null;
  providerPhone: string | null;
  providerEmail: string | null;
  status: string;
  createdAt: string;
}

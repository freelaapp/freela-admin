import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import type {
  ConsultantProfile,
  ConsultantVacancy,
  ConsultantVacancyCandidacy,
  CreateRegistrationPayload,
  RegistrationFilters,
  RegistrationItem,
  RegistrationPage,
  UpdateConsultantProfilePayload,
  VacancyModule,
} from "@/modules/consultant/domain/types";

/** Sessão do consultor — chave própria, isolada do `authUser` do staff. */
export const CONSULTANT_STORAGE_KEY = "consultantUser";

const consultantApi = createAuthedClient("/v1/consultants", {
  tokenStorageKey: CONSULTANT_STORAGE_KEY,
  loginPath: "/consultor/login",
});

/**
 * Endpoints consultor-scoped que vivem sob os módulos de produto
 * (`/v1/bars-restaurants/consultant`, `/v1/home-services/consultant`) — base distinta
 * da de `consultantApi`, mesma sessão de token.
 */
const consultantModulesApi = createAuthedClient("/v1", {
  tokenStorageKey: CONSULTANT_STORAGE_KEY,
  loginPath: "/consultor/login",
});

export interface ConsultantLoginResponse {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

export async function loginConsultantApi(
  email: string,
  password: string,
): Promise<ConsultantLoginResponse> {
  const res = await consultantApi.post("/login", { email, password });
  return res.data.data;
}

export async function changeConsultantPasswordApi(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await consultantApi.post("/me/change-password", { currentPassword, newPassword });
}

// ─── Perfil ───────────────────────────────────────────────────────────────────

export async function getConsultantProfileApi(): Promise<ConsultantProfile> {
  const res = await consultantApi.get("/me");
  return res.data.data;
}

export async function updateConsultantProfileApi(
  payload: UpdateConsultantProfilePayload,
): Promise<ConsultantProfile> {
  const res = await consultantApi.patch("/me", payload);
  return res.data.data;
}

// ─── Cadastros ────────────────────────────────────────────────────────────────

export async function createRegistrationApi(payload: CreateRegistrationPayload): Promise<{
  userId: string;
  inviteSentByWhatsApp: boolean;
  inviteSentByEmail: boolean;
  /** Senha padrão de 1º acesso (o contratante troca no primeiro login). */
  firstAccessPassword?: string;
}> {
  const res = await consultantApi.post("/me/registrations", payload);
  return res.data.data;
}

function withRegistrationDefaults(item: Partial<RegistrationItem>): RegistrationItem {
  return {
    companyName: null,
    city: null,
    uf: null,
    source: null,
    hasVacancy: false,
    ...item,
  } as RegistrationItem;
}

/**
 * Normaliza a resposta da lista. Aceita o formato ANTIGO (array, API antes do rollout de
 * 29/09) como uma página única, para o painel não quebrar se subir antes da API.
 */
export function toRegistrationPage(raw: unknown, filters: RegistrationFilters): RegistrationPage {
  if (Array.isArray(raw)) {
    const items = (raw as Partial<RegistrationItem>[]).map(withRegistrationDefaults);
    return { total: items.length, page: 1, pageSize: items.length || filters.pageSize, items };
  }
  const page = (raw ?? null) as Partial<RegistrationPage> | null;
  const items = (page?.items ?? []).map(withRegistrationDefaults);
  return {
    total: page?.total ?? items.length,
    page: page?.page ?? filters.page,
    pageSize: page?.pageSize ?? filters.pageSize,
    items,
  };
}

export async function listRegistrationsApi(filters: RegistrationFilters): Promise<RegistrationPage> {
  const params: Record<string, string | number> = { page: filters.page, pageSize: filters.pageSize };
  if (filters.type !== "all") params.type = filters.type;
  const q = filters.q.trim();
  if (q) params.q = q;
  const res = await consultantApi.get("/me/registrations", { params });
  return toRegistrationPage(res.data.data, filters);
}

// ─── Vagas dos clientes indicados ─────────────────────────────────────────────

/** Normaliza um item de vaga cru (BR ou Casa) para o shape unificado do dashboard. */
function mapVacancy(raw: Record<string, unknown>, module: VacancyModule): ConsultantVacancy {
  return {
    id: String(raw.id),
    module,
    title: (raw.title as string) ?? "",
    serviceType: (raw.serviceType as string) ?? "",
    date: (raw.date as string) ?? "",
    startTime: (raw.startTime as string) ?? "",
    endTime: (raw.endTime as string) ?? "",
    payment: Number(raw.payment ?? 0),
    status: (raw.status as string) ?? "",
    createdAt: (raw.createdAt as string) ?? "",
    contractorName: (raw.contractorName as string) ?? null,
    contractorCompanyName: (raw.contractorCompanyName as string) ?? null,
    candidacyCount: raw.candidacyCount as number | undefined,
    providerName: (raw.providerName as string | null | undefined) ?? null,
    providerPhone: (raw.providerPhone as string | null | undefined) ?? null,
    job: (raw.job as ConsultantVacancy["job"]) ?? null,
  };
}

const MODULE_PATH: Record<VacancyModule, string> = {
  "bars-restaurants": "bars-restaurants",
  "home-services": "home-services",
};

async function fetchVacancies(
  module: VacancyModule,
  kind: "open" | "closed",
): Promise<ConsultantVacancy[]> {
  const res = await consultantModulesApi.get(`/${MODULE_PATH[module]}/consultant/${kind}-vacancies`);
  const list = (res.data.data ?? []) as Record<string, unknown>[];
  return list.map((v) => mapVacancy(v, module));
}

/** Todas as vagas (abertas + fechadas, BR + Casa) dos contratantes indicados pelo consultor. */
export async function listConsultantVacanciesApi(): Promise<ConsultantVacancy[]> {
  const results = await Promise.all([
    fetchVacancies("bars-restaurants", "open"),
    fetchVacancies("bars-restaurants", "closed"),
    fetchVacancies("home-services", "open"),
    fetchVacancies("home-services", "closed"),
  ]);
  return results.flat();
}

/** Freelancers que se candidataram a uma vaga (somente BR; ownership validada no backend). */
export async function listConsultantVacancyCandidaciesApi(
  vacancyId: string,
): Promise<ConsultantVacancyCandidacy[]> {
  const res = await consultantModulesApi.get(
    `/bars-restaurants/consultant/vacancies/${vacancyId}/candidacies`,
  );
  return res.data.data;
}

export default consultantApi;

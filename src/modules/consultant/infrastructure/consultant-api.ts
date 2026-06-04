import axios, { type InternalAxiosRequestConfig } from "axios";
import type {
  ConsultantVacancy,
  ConsultantVacancyCandidacy,
  CreateRegistrationPayload,
  RegistrationItem,
  VacancyModule,
} from "@/modules/consultant/domain/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/** Sessão do consultor — chave própria, isolada do `authUser` do staff. */
export const CONSULTANT_STORAGE_KEY = "consultantUser";

/** Anexa o Bearer token do consultor (sessão própria, isolada do staff). */
function attachConsultantToken(config: InternalAxiosRequestConfig) {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(CONSULTANT_STORAGE_KEY);
    if (stored) {
      try {
        const session = JSON.parse(stored);
        if (session.accessToken) {
          config.headers.Authorization = `Bearer ${session.accessToken}`;
        }
      } catch {
        // ignore
      }
    }
  }
  return config;
}

const consultantApi = axios.create({
  baseURL: `${API_BASE_URL}/v1/consultants`,
  headers: { "Content-Type": "application/json" },
});

consultantApi.interceptors.request.use(attachConsultantToken);

/**
 * Endpoints consultor-scoped que vivem sob os módulos de produto
 * (`/v1/bars-restaurants/consultant`, `/v1/home-services/consultant`) — base distinta
 * da de `consultantApi`, mesma sessão de token.
 */
const consultantModulesApi = axios.create({
  baseURL: `${API_BASE_URL}/v1`,
  headers: { "Content-Type": "application/json" },
});

consultantModulesApi.interceptors.request.use(attachConsultantToken);

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

export async function createRegistrationApi(
  payload: CreateRegistrationPayload,
): Promise<{ userId: string; inviteSentByWhatsApp: boolean; inviteSentByEmail: boolean }> {
  const res = await consultantApi.post("/me/registrations", payload);
  return res.data.data;
}

export async function listRegistrationsApi(): Promise<RegistrationItem[]> {
  const res = await consultantApi.get("/me/registrations");
  return res.data.data;
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

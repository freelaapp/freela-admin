import axios from "axios";

// Vagas do Freela em Casa vivem sob /v1/home-services/admin (base distinta da de
// bares-restaurantes usada por `adminApi`). Mesma env + mesmo esquema de token.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const casaAdminApi = axios.create({
  baseURL: `${API_BASE_URL}/v1/home-services/admin`,
  headers: {
    "Content-Type": "application/json",
  },
});

casaAdminApi.interceptors.request.use((config) => {
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

export interface CasaVacancyItem {
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
  contractorName: string | null;
  contractorCompanyName: string | null;
  freelancerAmountInCents: number | null;
  platformFeeInCents: number | null;
  /** Consultor que indicou o contratante desta vaga (null quando não indicado). */
  referringConsultant?: { id: string; name: string; code: string } | null;
}

export async function getAdminCasaOpenVacancies(consultantId?: string): Promise<CasaVacancyItem[]> {
  const res = await casaAdminApi.get("/open-vacancies", {
    params: consultantId ? { consultantId } : undefined,
  });
  return res.data.data;
}

export async function getAdminCasaClosedVacancies(
  consultantId?: string,
): Promise<CasaVacancyItem[]> {
  const res = await casaAdminApi.get("/closed-vacancies", {
    params: consultantId ? { consultantId } : undefined,
  });
  return res.data.data;
}

export async function getAdminCasaAllVacancies(consultantId?: string): Promise<CasaVacancyItem[]> {
  const [open, closed] = await Promise.all([
    getAdminCasaOpenVacancies(consultantId),
    getAdminCasaClosedVacancies(consultantId),
  ]);
  return [...open, ...closed];
}

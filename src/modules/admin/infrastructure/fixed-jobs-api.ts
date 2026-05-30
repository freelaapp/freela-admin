import axios from "axios";

// Vagas Fixas (FixedJobPost) — listagem admin sob /v1/fixed-jobs/admin.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const fixedJobsAdminApi = axios.create({
  baseURL: `${API_BASE_URL}/v1/fixed-jobs/admin`,
  headers: {
    "Content-Type": "application/json",
  },
});

fixedJobsAdminApi.interceptors.request.use((config) => {
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

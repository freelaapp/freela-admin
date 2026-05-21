import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const whatsappApi = axios.create({
  baseURL: `${API_BASE_URL}/v1/admins/vacancy-group-routes`,
  headers: {
    "Content-Type": "application/json",
  },
});

whatsappApi.interceptors.request.use((config) => {
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

// ─── Types ────────────────────────────────────────────────────────────────

export interface VacancyGroupRoute {
  id: string;
  cityNormalized: string;
  cityLabel: string;
  groupJid: string;
  groupName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppGroup {
  jid: string;
  name: string;
  participants: number | null;
}

export interface CreateRoutePayload {
  city: string;
  groupJid: string;
  groupName?: string;
}

export interface UpdateRoutePayload {
  city?: string;
  groupJid?: string;
  groupName?: string;
}

// ─── API ──────────────────────────────────────────────────────────────────

export async function getVacancyGroupRoutes(): Promise<VacancyGroupRoute[]> {
  const res = await whatsappApi.get("");
  return res.data.data;
}

export async function getWhatsAppGroups(): Promise<WhatsAppGroup[]> {
  const res = await whatsappApi.get("/whatsapp-groups");
  return res.data.data;
}

export async function createVacancyGroupRoute(
  payload: CreateRoutePayload,
): Promise<VacancyGroupRoute> {
  const res = await whatsappApi.post("", payload);
  return res.data.data;
}

export async function updateVacancyGroupRoute(
  id: string,
  payload: UpdateRoutePayload,
): Promise<VacancyGroupRoute> {
  const res = await whatsappApi.put(`/${id}`, payload);
  return res.data.data;
}

export async function deleteVacancyGroupRoute(id: string): Promise<void> {
  await whatsappApi.delete(`/${id}`);
}

// ─── State (UF) routes ──────────────────────────────────────────────────────

export interface VacancyGroupStateRoute {
  id: string;
  uf: string;
  groupJid: string;
  groupName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStateRoutePayload {
  uf: string;
  groupJid: string;
  groupName?: string;
}

export interface UpdateStateRoutePayload {
  uf?: string;
  groupJid?: string;
  groupName?: string;
}

export async function getVacancyGroupStateRoutes(): Promise<VacancyGroupStateRoute[]> {
  const res = await whatsappApi.get("/states");
  return res.data.data;
}

export async function createVacancyGroupStateRoute(
  payload: CreateStateRoutePayload,
): Promise<VacancyGroupStateRoute> {
  const res = await whatsappApi.post("/states", payload);
  return res.data.data;
}

export async function updateVacancyGroupStateRoute(
  id: string,
  payload: UpdateStateRoutePayload,
): Promise<VacancyGroupStateRoute> {
  const res = await whatsappApi.put(`/states/${id}`, payload);
  return res.data.data;
}

export async function deleteVacancyGroupStateRoute(id: string): Promise<void> {
  await whatsappApi.delete(`/states/${id}`);
}

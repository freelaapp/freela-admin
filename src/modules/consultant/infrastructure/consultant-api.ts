import axios from "axios";
import type {
  CreateRegistrationPayload,
  RegistrationItem,
} from "@/modules/consultant/domain/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/** Sessão do consultor — chave própria, isolada do `authUser` do staff. */
export const CONSULTANT_STORAGE_KEY = "consultantUser";

const consultantApi = axios.create({
  baseURL: `${API_BASE_URL}/v1/consultants`,
  headers: { "Content-Type": "application/json" },
});

consultantApi.interceptors.request.use((config) => {
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

export default consultantApi;

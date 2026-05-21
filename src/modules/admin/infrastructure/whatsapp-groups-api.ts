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

/**
 * Routing is fully automatic from the WhatsApp group names ("Vagas <Cidade> <UF>"),
 * so the admin panel is read-only diagnostics: which groups were recognized and
 * which are off-pattern (and therefore unreachable by routing).
 */
export interface GroupDiagnostic {
  jid: string;
  name: string;
  participants: number | null;
  city: string | null;
  uf: string | null;
  recognized: boolean;
}

export async function getGroupDiagnostics(): Promise<GroupDiagnostic[]> {
  const res = await whatsappApi.get("/diagnostics");
  return res.data.data;
}

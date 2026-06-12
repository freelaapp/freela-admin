import axios from "axios";
import type { ServiceModule } from "./catalog-api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Endpoints admin que existem por módulo (`/v1/{module}/admin/...`) agregados
 * nos dois módulos (Empresa + Casa). O admin-api.ts é fixo em bars-restaurants;
 * este client deixa o módulo no path de cada chamada.
 */
const bothModulesApi = axios.create({
  baseURL: `${API_BASE_URL}/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

bothModulesApi.interceptors.request.use((config) => {
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

const MODULES: ServiceModule[] = ["bars-restaurants", "home-services"];

// ─── Contratantes (Empresa + Casa) ──────────────────────────────────────────

export interface ContractorAcrossModules {
  id: string;
  userId: string;
  companyName: string | null;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string;
  city: string;
  uf: string;
  segment: string | null;
  isActive: boolean;
  /** Preenchido no cliente (a API responde por módulo). */
  module: ServiceModule;
}

async function fetchModuleContractors(
  module: ServiceModule,
): Promise<ContractorAcrossModules[]> {
  const res = await bothModulesApi.get(`/${module}/admin/contractors`);
  const rows: Omit<ContractorAcrossModules, "module">[] = res.data.data ?? [];
  return rows.map((c) => ({ ...c, module }));
}

export async function getAllContractors(): Promise<ContractorAcrossModules[]> {
  const results = await Promise.all(
    MODULES.map((m) => fetchModuleContractors(m).catch(() => [])),
  );
  return results.flat();
}

// ─── Prestadores (Empresa + Casa) ───────────────────────────────────────────

export interface ProviderAcrossModules {
  id: string;
  userId: string;
  name: string | null;
  city: string | null;
  uf: string | null;
  isActive: boolean;
  services: string[];
  /** Preenchido no cliente (a API responde por módulo). */
  module: ServiceModule;
}

const PAGE_LIMIT = 500; // MAX_LIMIT da API
const MAX_PAGES = 40; // trava de segurança (≤ 20k prestadores/módulo)

// A API responde { data: [...], meta: { total } }. Paginamos por tamanho de
// página: a última página vem com menos itens que o limite.
async function fetchModuleProviders(
  module: ServiceModule,
): Promise<ProviderAcrossModules[]> {
  const out: ProviderAcrossModules[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await bothModulesApi.get(`/${module}/admin/providers`, {
      params: { page, limit: PAGE_LIMIT },
    });
    const rows: Omit<ProviderAcrossModules, "module">[] = res.data.data ?? [];
    for (const p of rows) out.push({ ...p, module, services: p.services ?? [] });
    if (rows.length < PAGE_LIMIT) break;
  }
  return out;
}

export async function getAllProviders(): Promise<ProviderAcrossModules[]> {
  const results = await Promise.all(
    MODULES.map((m) => fetchModuleProviders(m).catch(() => [])),
  );
  return results.flat();
}

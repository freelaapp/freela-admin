import axios from "axios";

/**
 * Client dos cadastros do Freela Fretes.
 *
 * Aponta para `/api/fretes/*` — o proxy do PRÓPRIO painel, não a API de fretes.
 * A API de lá autentica por chave estática que dá acesso a todos os cadastros
 * (CPF, CNH, telefone), então ela fica no servidor; o navegador só manda o
 * Bearer do admin, que o proxy valida antes de repassar.
 */
const fretesApi = axios.create({ baseURL: "/api/fretes", timeout: 30_000 });

fretesApi.interceptors.request.use((config) => {
  if (typeof window === "undefined") return config;
  const raw = localStorage.getItem("authUser");
  const token = raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Resposta paginada da API de fretes: `{ data, total, page, limit }`. */
export interface FretesPage<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DriverRegistration {
  id: string;
  cpf: string;
  fullName: string;
  email: string;
  phone: string;
  birthdate: string;
  cnhNumber: string;
  cnhCategory: string;
  cnhExpiresAt: string;
  vehicleType: string;
  bodyType: string;
  plate: string;
  capacityKg: number;
  city: string;
  uf: string;
  createdAt: string;
}

export interface CompanyRegistration {
  id: string;
  cnpj: string;
  corporateReason: string;
  companyName: string;
  segment: string;
  monthlyFreightVolume: string;
  contactName: string;
  contactEmail: string;
  cpf: string;
  contactPhone: string;
  isCompanyPartner: boolean;
  createdAt: string;
}

/** Teto da API de fretes por página (ela satura em 200). */
const MAX_LIMIT = 200;

export async function getDriverRegistrations(page = 1, limit = MAX_LIMIT) {
  const res = await fretesApi.get<FretesPage<DriverRegistration>>("/v1/registrations/drivers", {
    params: { page, limit },
  });
  return res.data;
}

export async function getCompanyRegistrations(page = 1, limit = MAX_LIMIT) {
  const res = await fretesApi.get<FretesPage<CompanyRegistration>>("/v1/registrations/companies", {
    params: { page, limit },
  });
  return res.data;
}

/** CPF/CNPJ chegam só com dígitos — formata para leitura. */
export function formatDocument(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return value || "—";
}

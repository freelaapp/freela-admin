import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const catalogApi = axios.create({
  baseURL: `${API_BASE_URL}/v1/admin/catalog`,
  headers: {
    "Content-Type": "application/json",
  },
});

catalogApi.interceptors.request.use((config) => {
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

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type ServiceModule = "bars-restaurants" | "home-services";
export type PricingModel = "HOURLY" | "TIERED";
export type BonusModel = "TIP" | "EVALUATION";

export const MODULE_LABEL: Record<ServiceModule, string> = {
  "bars-restaurants": "Empresa (Bares/Restaurantes)",
  "home-services": "Freela em Casa",
};

export const BONUS_LABEL: Record<BonusModel, string> = {
  TIP: "Gorjeta",
  EVALUATION: "Avaliação (bônus 5★)",
};

export const PRICING_LABEL: Record<PricingModel, string> = {
  HOURLY: "Por hora",
  TIERED: "Por faixa (tamanho)",
};

export interface ServiceRole {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  aliases: string[];
  bonusModel: BonusModel;
  active: boolean;
}

export interface CategoryRoleTier {
  id?: string;
  label: string;
  totalInCents: number;
  displayOrder?: number;
  active?: boolean;
}

export interface CategoryRole {
  id: string;
  categoryId: string;
  roleId: string;
  hourlyRateInCents: number;
  minimumJourneyHours: number;
  referenceTotalInCents: number;
  isDaytimeOnly: boolean;
  pricingModel: PricingModel;
  tierQualifierLabel: string | null;
  displayOrder: number;
  active: boolean;
  role: ServiceRole;
  tiers: CategoryRoleTier[];
}

export interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  module: ServiceModule;
  icon: string | null;
  displayOrder: number;
  active: boolean;
  roles: CategoryRole[];
}

export interface CreateCategoryInput {
  slug: string;
  name: string;
  module: ServiceModule;
  icon?: string;
  displayOrder?: number;
}
export type UpdateCategoryInput = Partial<Omit<CreateCategoryInput, "slug">> & {
  active?: boolean;
};

export interface CreateRoleInput {
  slug: string;
  name: string;
  icon?: string;
  aliases?: string[];
  bonusModel?: BonusModel;
}
export type UpdateRoleInput = Partial<Omit<CreateRoleInput, "slug">> & {
  active?: boolean;
};

export interface SetCategoryRoleInput {
  hourlyRateInCents: number;
  minimumJourneyHours: number;
  referenceTotalInCents?: number;
  isDaytimeOnly?: boolean;
  displayOrder?: number;
  active?: boolean;
  pricingModel?: PricingModel;
  tierQualifierLabel?: string | null;
  tiers?: CategoryRoleTier[];
}

// ─── Funções ────────────────────────────────────────────────────────────────

// Categorias (inclui inativas; já traz roles + role + tiers)
export async function getCatalogCategories(): Promise<ServiceCategory[]> {
  const res = await catalogApi.get("/categories");
  return res.data.data;
}

export async function createCatalogCategory(
  dto: CreateCategoryInput,
): Promise<ServiceCategory> {
  const res = await catalogApi.post("/categories", dto);
  return res.data.data;
}

export async function updateCatalogCategory(
  id: string,
  dto: UpdateCategoryInput,
): Promise<ServiceCategory> {
  const res = await catalogApi.patch(`/categories/${id}`, dto);
  return res.data.data;
}

export async function deactivateCatalogCategory(id: string): Promise<ServiceCategory> {
  const res = await catalogApi.delete(`/categories/${id}`);
  return res.data.data;
}

// Funções (roles)
export async function getCatalogRoles(): Promise<ServiceRole[]> {
  const res = await catalogApi.get("/roles");
  return res.data.data;
}

export async function createCatalogRole(dto: CreateRoleInput): Promise<ServiceRole> {
  const res = await catalogApi.post("/roles", dto);
  return res.data.data;
}

export async function updateCatalogRole(
  id: string,
  dto: UpdateRoleInput,
): Promise<ServiceRole> {
  const res = await catalogApi.patch(`/roles/${id}`, dto);
  return res.data.data;
}

// Preço da função dentro da categoria (hora ou faixa + tiers)
export async function setCatalogCategoryRole(
  categoryId: string,
  roleId: string,
  dto: SetCategoryRoleInput,
): Promise<void> {
  await catalogApi.put(`/categories/${categoryId}/roles/${roleId}`, dto);
}

export async function removeCatalogCategoryRole(
  categoryId: string,
  roleId: string,
): Promise<void> {
  await catalogApi.delete(`/categories/${categoryId}/roles/${roleId}`);
}

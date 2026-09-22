import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const api = createAuthedClient("/v1/admin/regional-pricing");

export type RegionalModule = "bars-restaurants" | "home-services";
export type SourceStatus = "Confirmado" | "Parcial" | "Pendente";

export interface RegionalRule {
  id: string;
  module: RegionalModule;
  uf: string;
  /** "" = regra da UF. */
  city: string;
  multiplierBps: number;
  label: string | null;
  sourceStatus: SourceStatus | null;
  note: string | null;
  active: boolean;
  updatedAt: string;
  preview: { auxiliarInCents: number; tecnicoInCents: number };
}

export interface RegionalPricingData {
  /** Flag mestre (env). Nada muda no preço com ela OFF, mesmo com regras. */
  globalEnabled: boolean;
  referenceBase: { auxiliarInCents: number; tecnicoInCents: number };
  rules: RegionalRule[];
}

export interface UpsertRegionalRuleInput {
  module: RegionalModule;
  multiplierBps: number;
  label?: string;
  sourceStatus?: SourceStatus;
  note?: string;
  active?: boolean;
}

export async function getRegionalPricing(module: RegionalModule): Promise<RegionalPricingData> {
  const res = await api.get("", { params: { module } });
  return res.data.data;
}

export async function upsertRegionalRule(
  uf: string,
  city: string,
  input: UpsertRegionalRuleInput,
): Promise<void> {
  const path = city ? `/${uf}/${encodeURIComponent(city)}` : `/${uf}`;
  await api.put(path, input);
}

export async function deleteRegionalRule(uf: string, city: string, module: RegionalModule): Promise<void> {
  const path = city ? `/${uf}/${encodeURIComponent(city)}` : `/${uf}`;
  await api.delete(path, { params: { module } });
}

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Catálogo IBGE (Kernel Compartilhado) — sem prefixo de produto, por isso o
 * client fica na raiz `/v1` em vez de `/v1/bars-restaurants/...` (ADR-011).
 * `shared.cities` está vazia em prod; é este endpoint (`/cities/catalog`),
 * não `GET /v1/cities`, que devolve os ~5570 municípios oficiais.
 */
const citiesApi = createAuthedClient("/v1");

export interface CityCatalogEntry {
  name: string;
  uf: string;
}

export async function getCitiesCatalog(): Promise<CityCatalogEntry[]> {
  const res = await citiesApi.get("/cities/catalog");
  return res.data.data ?? [];
}

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

// Propagandas (Ads v1) — endpoints admin sob /v1/admins/advertisements (shared
// kernel, super-admin), mesma base/token de `partnerships-api.ts`. Contratos:
// api-freela/docs/specs/2026-07-09-ads-system-design.md §2.3.
const adsApi = createAuthedClient("/v1/admins/advertisements");

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type AdAudience = "FREELANCER" | "CONTRACTOR" | "BOTH";

export interface AdvertisementItem {
  id: string;
  title: string;
  imageKey: string;
  /** URL presignada (24h) para a miniatura. */
  imageUrl: string | null;
  targetUrl: string | null;
  audience: AdAudience;
  displayOrder: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  viewsCount: number;
  clicksCount: number;
  /** Parceria vinculada (captura leads no clique logado); null = sem parceria. */
  partnerId: string | null;
  partnerName: string | null;
  createdAt: string;
}

export interface CreateAdPayload {
  title: string;
  imageKey: string;
  /** Se presente, deve ser URL https://. */
  targetUrl?: string;
  audience: AdAudience;
  displayOrder?: number;
  active?: boolean;
  /** ISO-8601 com offset -03:00 (convenção Brasília, spec §2.3). */
  startsAt?: string;
  endsAt?: string;
  /** UUID de uma parceria; omitido = sem parceria. */
  partnerId?: string;
}

/** PATCH parcial — `null` limpa os campos opcionais (link/datas/parceria). */
export type UpdateAdPayload = Partial<{
  title: string;
  imageKey: string;
  targetUrl: string | null;
  audience: AdAudience;
  displayOrder: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  partnerId: string | null;
}>;

export interface AdImageUpload {
  /** objectKey S3 a persistir no anúncio (`imageKey`). */
  key: string;
  /** URL presignada para preview imediato no formulário. */
  url: string;
}

// ─── Funções ────────────────────────────────────────────────────────────────

// `get("")`/`post("", ...)` (e não "/") evitam a barra final na URL — Fastify
// trata `/rota` e `/rota/` como rotas distintas por padrão.

export async function getAds(): Promise<AdvertisementItem[]> {
  const res = await adsApi.get("");
  return res.data.data;
}

export async function createAd(payload: CreateAdPayload): Promise<AdvertisementItem> {
  const res = await adsApi.post("", payload);
  return res.data.data;
}

export async function updateAd(
  id: string,
  payload: UpdateAdPayload,
): Promise<AdvertisementItem> {
  const res = await adsApi.patch(`/${id}`, payload);
  return res.data.data;
}

export async function deleteAd(id: string): Promise<void> {
  await adsApi.delete(`/${id}`);
}

/**
 * Upload multipart do banner (campo `file`, PNG/JPEG/WebP, máx 5 MB).
 *
 * O header `multipart/form-data` SEM boundary faz o axios delegar ao browser a
 * serialização do FormData (que define o boundary correto). Sem esse override,
 * o default `application/json` do client serializaria o FormData como JSON.
 */
export async function uploadAdImage(file: File): Promise<AdImageUpload> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await adsApi.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}

export default adsApi;

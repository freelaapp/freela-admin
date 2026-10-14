import axios from "axios";
import { z } from "zod";

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Divulgação da vaga de Empresas nos grupos de WhatsApp (grupo da cidade da
 * vaga + grupos de cidades a até R km). Contrato da API (14/10/2026):
 *
 * - `GET  /v1/bars-restaurants/admin/vacancies/:id/group-broadcasts`
 * - `GET  /v1/bars-restaurants/admin/vacancies/:id/group-broadcasts/preview`
 * - `POST /v1/bars-restaurants/admin/vacancies/:id/resend-group-message`
 * - `GET  /v1/admins/vacancy-outreach` → `groupBroadcast.lastRound` por registro
 *
 * TODOS os tipos e validações moram aqui, num lugar só: a API foi feita em
 * paralelo e qualquer ajuste de contrato muda só este arquivo.
 *
 * A leitura é TOLERANTE de propósito: campo que falta vira nulo/zero e valor
 * de enum desconhecido vira "UNKNOWN", em vez de a tela inteira cair em "erro
 * ao carregar" por causa de um detalhe. A API antiga (sem nada disso) também
 * passa por aqui sem quebrar.
 */

// ─── Tipos normalizados (o que a tela usa) ──────────────────────────────────

export type GroupBroadcastMode = "AUTO" | "MANUAL";

/** Por que o grupo entrou na rodada. */
export type GroupDestinationReason =
  | "VACANCY_CITY"
  | "RADIUS"
  | "FALLBACK"
  | "VIP_STORE_GROUP"
  | "UNKNOWN";

export type GroupDestinationStatus =
  | "PENDING"
  | "SENDING"
  | "SENT"
  | "FAILED"
  | "SKIPPED"
  | "UNKNOWN";

/** De onde saiu o ponto usado como centro do raio. `null` = sem ponto nenhum. */
export type GroupBroadcastCenterSource = "VACANCY" | "CONTRACTOR" | "CITY_SEAT" | null;

export interface GroupBroadcastCenter {
  source: GroupBroadcastCenterSource;
  city: string | null;
  uf: string | null;
}

export interface GroupBroadcastDestination {
  groupJid: string;
  groupName: string;
  city: string | null;
  uf: string | null;
  /** Linha reta do centro do raio até o centro da cidade do grupo (km, sem arredondar). */
  distanceKm: number | null;
  reason: GroupDestinationReason;
  status: GroupDestinationStatus;
  errorCode: string | null;
  /** Motivo em linguagem comum, para mostrar como veio. */
  errorMessage: string | null;
  sentAt: string | null;
}

export interface GroupBroadcastSummary {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  ownCity: number;
  inRadius: number;
}

export interface GroupBroadcastRound {
  roundId: string;
  mode: GroupBroadcastMode;
  createdAt: string;
  summary: GroupBroadcastSummary;
  destinations: GroupBroadcastDestination[];
}

export interface GroupBroadcastLegacy {
  autoSentAt: string | null;
  manualSentAt: string | null;
}

export interface VacancyGroupBroadcasts {
  radiusKm: number;
  center: GroupBroadcastCenter;
  /** Mais nova primeiro. */
  rounds: GroupBroadcastRound[];
  /** Disparo anterior ao registro por grupo (só sabemos que saiu e quando). */
  legacy: GroupBroadcastLegacy | null;
}

/** Grupo que VAI receber, na prévia do reenvio. */
export interface GroupBroadcastPreviewDestination {
  groupJid: string;
  groupName: string;
  city: string | null;
  uf: string | null;
  distanceKm: number | null;
  reason: GroupDestinationReason;
}

/** Grupo que fica de fora do reenvio (ex.: passou do limite de grupos por vaga). */
export interface GroupBroadcastPreviewSkipped {
  groupName: string;
  city: string | null;
  uf: string | null;
  distanceKm: number | null;
  /** Texto da API, mostrado como veio. */
  reason: string | null;
}

export interface GroupBroadcastPreview {
  radiusKm: number;
  center: GroupBroadcastCenter;
  destinations: GroupBroadcastPreviewDestination[];
  skipped: GroupBroadcastPreviewSkipped[];
}

/** Resposta do reenvio. `roundId === null` = API antiga (envio síncrono, só o grupo da cidade). */
export interface ResendGroupResult {
  roundId: string | null;
  destinations: GroupBroadcastPreviewDestination[];
}

/** Resumo da última rodada, por vaga, na lista (coluna "Disparo"). */
export interface GroupBroadcastLastRound {
  mode: GroupBroadcastMode;
  at: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  ownCity: number;
  inRadius: number;
}

export interface OutreachGroupBroadcast {
  lastRound: GroupBroadcastLastRound | null;
}

// ─── Esquemas tolerantes ─────────────────────────────────────────────────────

const text = z.string().nullable().catch(null);
const requiredText = z.string().catch("");
const count = z.number().int().nonnegative().catch(0);
const km = z.number().finite().nullable().catch(null);
const radius = z.number().finite().nonnegative().catch(0);
/** Grupo sem nome ainda aparece (a linha existe); só não tem como chamar. */
const groupName = z.string().min(1).catch("Grupo sem nome");

const mode = z
  .string()
  .transform((s): GroupBroadcastMode => (s.toUpperCase() === "MANUAL" ? "MANUAL" : "AUTO"))
  .catch("AUTO");

const REASONS = new Set(["VACANCY_CITY", "RADIUS", "FALLBACK", "VIP_STORE_GROUP"]);
const reason = z
  .string()
  .transform((s) => {
    const up = s.toUpperCase();
    return (REASONS.has(up) ? up : "UNKNOWN") as GroupDestinationReason;
  })
  .catch("UNKNOWN");

const STATUSES = new Set(["PENDING", "SENDING", "SENT", "FAILED", "SKIPPED"]);
const status = z
  .string()
  .transform((s) => {
    const up = s.toUpperCase();
    return (STATUSES.has(up) ? up : "UNKNOWN") as GroupDestinationStatus;
  })
  .catch("UNKNOWN");

const SOURCES = new Set(["VACANCY", "CONTRACTOR", "CITY_SEAT"]);
const centerSource = z
  .string()
  .nullable()
  .transform((s) => {
    const up = s?.toUpperCase() ?? null;
    return (up && SOURCES.has(up) ? up : null) as GroupBroadcastCenterSource;
  })
  .catch(null);

const centerSchema = z
  .object({ source: centerSource, city: text, uf: text })
  .catch({ source: null, city: null, uf: null });

/** Lista em que um item quebrado sai da lista, em vez de derrubar a resposta. */
function tolerantArray<T extends z.ZodTypeAny>(item: T) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items.flatMap((raw) => {
        const parsed = item.safeParse(raw);
        return parsed.success ? [parsed.data as z.output<T>] : [];
      }),
    );
}

const destinationSchema = z.object({
  groupJid: requiredText,
  groupName,
  city: text,
  uf: text,
  distanceKm: km,
  reason,
  status,
  errorCode: text,
  errorMessage: text,
  sentAt: text,
});

const previewDestinationSchema = z.object({
  groupJid: requiredText,
  groupName,
  city: text,
  uf: text,
  distanceKm: km,
  reason,
});

const previewSkippedSchema = z.object({
  groupName,
  city: text,
  uf: text,
  distanceKm: km,
  reason: text,
});

const summarySchema = z
  .object({
    total: count,
    sent: count,
    failed: count,
    skipped: count,
    pending: count,
    ownCity: count,
    inRadius: count,
  })
  .nullable()
  .catch(null);

const roundSchema = z.object({
  roundId: z.string().min(1),
  mode,
  createdAt: requiredText,
  summary: summarySchema,
  destinations: tolerantArray(destinationSchema),
});

const legacySchema = z
  .object({ autoSentAt: text, manualSentAt: text })
  .nullable()
  .catch(null);

const broadcastsSchema = z.object({
  radiusKm: radius,
  center: centerSchema,
  rounds: tolerantArray(roundSchema),
  legacy: legacySchema,
});

const previewSchema = z.object({
  radiusKm: radius,
  center: centerSchema,
  destinations: tolerantArray(previewDestinationSchema),
  skipped: tolerantArray(previewSkippedSchema),
});

const lastRoundSchema = z
  .object({
    mode,
    at: z.string().min(1),
    total: count,
    sent: count,
    failed: count,
    skipped: count,
    pending: count,
    ownCity: count,
    inRadius: count,
  })
  .nullable()
  .catch(null);

// ─── Normalizadores (exportados para os testes e para o cliente da lista) ──

/** Resumo calculado das linhas, quando a API não manda `summary`. */
export function summarizeDestinations(
  destinations: GroupBroadcastDestination[],
): GroupBroadcastSummary {
  const by = (s: GroupDestinationStatus) => destinations.filter((d) => d.status === s).length;
  const attempted = destinations.filter((d) => d.status !== "SKIPPED");
  return {
    total: destinations.length,
    sent: by("SENT"),
    failed: by("FAILED"),
    skipped: by("SKIPPED"),
    pending: by("PENDING") + by("SENDING"),
    ownCity: attempted.filter((d) => d.reason === "VACANCY_CITY").length,
    inRadius: attempted.filter((d) => d.reason === "RADIUS").length,
  };
}

export function parseVacancyGroupBroadcasts(raw: unknown): VacancyGroupBroadcasts {
  const parsed = broadcastsSchema.safeParse(raw ?? {});
  const data = parsed.success
    ? parsed.data
    : { radiusKm: 0, center: { source: null, city: null, uf: null }, rounds: [], legacy: null };
  const rounds: GroupBroadcastRound[] = data.rounds.map((r) => ({
    ...r,
    summary: r.summary ?? summarizeDestinations(r.destinations),
  }));
  // "Mais nova primeiro" é o contrato; ordenar de novo não custa e protege a tela.
  rounds.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  const legacy =
    data.legacy && (data.legacy.autoSentAt || data.legacy.manualSentAt) ? data.legacy : null;
  return { ...data, rounds, legacy };
}

export function parseGroupBroadcastPreview(raw: unknown): GroupBroadcastPreview {
  const parsed = previewSchema.safeParse(raw ?? {});
  return parsed.success
    ? parsed.data
    : { radiusKm: 0, center: { source: null, city: null, uf: null }, destinations: [], skipped: [] };
}

export function parseResendGroupResult(raw: unknown): ResendGroupResult {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const roundId = typeof obj.roundId === "string" && obj.roundId ? obj.roundId : null;
  const destinations = tolerantArray(previewDestinationSchema).parse(obj.destinations);
  return { roundId, destinations };
}

/**
 * `undefined` = API antiga (sem o campo): a coluna mostra como antes.
 * `null` = API nova sem rodada registrada (o mesmo que `{ lastRound: null }`).
 */
export function parseOutreachGroupBroadcast(raw: unknown): OutreachGroupBroadcast | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return { lastRound: null };
  if (typeof raw !== "object") return undefined;
  const lastRound = lastRoundSchema.parse((raw as Record<string, unknown>).lastRound ?? null);
  return { lastRound };
}

/** A rota não existe (API antiga) ou a vaga não é de Empresas: a tela degrada. */
export function isNotFoundError(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 404;
}

// ─── Rotas ───────────────────────────────────────────────────────────────────

const barsAdminApi = createAuthedClient("/v1/bars-restaurants/admin");

export async function getVacancyGroupBroadcasts(vacancyId: string): Promise<VacancyGroupBroadcasts> {
  const res = await barsAdminApi.get(`/vacancies/${vacancyId}/group-broadcasts`);
  return parseVacancyGroupBroadcasts(res.data?.data);
}

export async function getVacancyGroupBroadcastPreview(
  vacancyId: string,
): Promise<GroupBroadcastPreview> {
  const res = await barsAdminApi.get(`/vacancies/${vacancyId}/group-broadcasts/preview`);
  return parseGroupBroadcastPreview(res.data?.data);
}

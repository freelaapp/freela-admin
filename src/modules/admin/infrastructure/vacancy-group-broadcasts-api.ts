import axios from "axios";
import { z } from "zod";

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Divulgação da vaga de Empresas nos grupos de WhatsApp (grupo da cidade da
 * vaga + grupos de cidades a até R km). Contrato FINAL da API (14/10/2026):
 *
 * - `GET  /v1/bars-restaurants/admin/vacancies/:id/group-broadcasts`
 *   (404 `VACANCY_NOT_FOUND`, 503 `GROUP_BROADCAST_UNAVAILABLE`)
 * - `GET  /v1/bars-restaurants/admin/vacancies/:id/group-broadcasts/preview`
 *   (404 `VACANCY_NOT_FOUND`/`CONTRACTOR_NOT_FOUND`, 503 `GROUP_DIRECTORY_UNAVAILABLE`)
 * - `POST /v1/bars-restaurants/admin/vacancies/:id/resend-group-message`
 *   (409 `VACANCY_NOT_OPEN`/`BROADCAST_IN_PROGRESS`, 400 `NO_DESTINATION_GROUP`…)
 * - `GET  /v1/admins/vacancy-outreach` → `groupBroadcast.lastRound` por registro
 *
 * TODOS os tipos e validações moram aqui, num lugar só: qualquer ajuste de
 * contrato muda só este arquivo.
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
  /** Grupo de reserva da configuração (`*_GROUP_MAP`/`*_GROUP_NUMBER`). */
  | "FALLBACK"
  /** Grupo VIP da loja (vaga só VIP). */
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

export interface GroupBroadcastDestination {
  groupJid: string;
  groupName: string;
  city: string | null;
  uf: string | null;
  /** Linha reta do centro do raio até o centro da cidade do grupo (km, 1 casa). */
  distanceKm: number | null;
  reason: GroupDestinationReason;
  status: GroupDestinationStatus;
  /** `WHATSAPP_DESLIGADO`, `FALHA_NO_ENVIO`, `ENVIO_INTERROMPIDO`, `EXPIRADO`, `LIMITE_DE_GRUPOS`… */
  errorCode: string | null;
  /** Motivo em linguagem comum (campo `error` da API), mostrado como veio. */
  error: string | null;
  sentAt: string | null;
}

/** Até 3 grupos que falharam, com o motivo (resumo da rodada e da coluna). */
export interface GroupBroadcastFailedGroup {
  groupName: string;
  errorMessage: string | null;
}

/**
 * Contagem de UMA rodada. `total` = tentados (enviados + falhos + na fila) =
 * `ownCity + inRadius + fallback + vip`; os pulados ficam fora do total.
 */
export interface GroupBroadcastSummary {
  total: number;
  sent: number;
  failedCount: number;
  failed: GroupBroadcastFailedGroup[];
  skipped: number;
  pending: number;
  ownCity: number;
  inRadius: number;
  fallback: number;
  vip: number;
}

export interface GroupBroadcastRound {
  roundId: string;
  mode: GroupBroadcastMode;
  createdAt: string;
  /** Raio usado NESTA rodada (0 = só a cidade). */
  radiusKm: number;
  /** Centro usado nesta rodada; `null` = vaga sem localização (só o grupo da cidade). */
  centerSource: GroupBroadcastCenterSource;
  summary: GroupBroadcastSummary;
  destinations: GroupBroadcastDestination[];
}

export interface VacancyGroupBroadcasts {
  /** Raio configurado agora. */
  radiusKm: number;
  /** Último envio confirmado (o mesmo da coluna "Disparo"); cobre a vaga antiga. */
  groupBroadcastAt: string | null;
  /** Grupos ainda na fila ou saindo, em qualquer rodada. */
  inFlight: number;
  canResend: boolean;
  /** Por que não dá para reenviar agora (vaga não aberta, envio em andamento). */
  resendBlockedReason: string | null;
  /** Mais nova primeiro. Vazio + `groupBroadcastAt` = registro antigo. */
  rounds: GroupBroadcastRound[];
}

/** Grupo da prévia do reenvio (vai receber, ou fica de fora pelo teto). */
export interface GroupBroadcastPreviewDestination {
  groupJid: string;
  groupName: string;
  city: string | null;
  uf: string | null;
  distanceKm: number | null;
  reason: GroupDestinationReason;
}

export interface GroupBroadcastPreview {
  radiusKm: number;
  vacancyCity: string | null;
  vacancyUf: string | null;
  centerSource: GroupBroadcastCenterSource;
  /** A cidade da vaga tem grupo próprio? */
  ownCityHasGroup: boolean;
  /** Nenhum grupo pelo nome: vai para o grupo de reserva da configuração. */
  fallbackUsed: boolean;
  destinations: GroupBroadcastPreviewDestination[];
  /** Ficam de fora pelo teto (8 cidades vizinhas / 20 grupos por vaga). */
  skipped: GroupBroadcastPreviewDestination[];
  canResend: boolean;
  resendBlockedReason: string | null;
}

/** Resposta do reenvio. `roundId === null` = API antiga (envio síncrono, só o grupo da cidade). */
export interface ResendGroupResult {
  roundId: string | null;
  destinations: GroupBroadcastPreviewDestination[];
}

/** Resumo da última rodada, por vaga, na lista (coluna "Disparo"). */
export interface GroupBroadcastLastRound {
  roundId: string | null;
  mode: GroupBroadcastMode;
  at: string;
  /** Tentados (enviados + falhos + na fila). Pulados ficam fora. */
  total: number;
  sent: number;
  failedCount: number;
  /** Até 3, com o motivo, para o tooltip. */
  failed: GroupBroadcastFailedGroup[];
  skipped: number;
  pending: number;
  ownCity: number;
  inRadius: number;
  fallback: number;
  vip: number;
}

export interface OutreachGroupBroadcast {
  /** `null` = registro antigo (saiu antes do registro por grupo). */
  lastRound: GroupBroadcastLastRound | null;
}

// ─── Esquemas tolerantes ─────────────────────────────────────────────────────

const text = z.string().nullable().catch(null);
const requiredText = z.string().catch("");
const count = z.number().int().nonnegative().catch(0);
const km = z.number().finite().nullable().catch(null);
const radius = z.number().finite().nonnegative().catch(0);
const flag = (padrao: boolean) => z.boolean().catch(padrao);
/** Grupo sem nome ainda aparece (a linha existe); só não tem como chamar. */
const groupName = z.string().min(1).catch("Grupo sem nome");

const mode = z
  .string()
  .transform((s): GroupBroadcastMode => (s.toUpperCase() === "MANUAL" ? "MANUAL" : "AUTO"))
  .catch("AUTO");

function upperEnum<T extends string>(valores: readonly T[]) {
  const set = new Set<string>(valores);
  return z
    .string()
    .transform((s) => {
      const up = s.toUpperCase();
      return (set.has(up) ? up : "UNKNOWN") as T | "UNKNOWN";
    })
    .catch("UNKNOWN" as const);
}

const reason = upperEnum(["VACANCY_CITY", "RADIUS", "FALLBACK", "VIP_STORE_GROUP"] as const);
const status = upperEnum(["PENDING", "SENDING", "SENT", "FAILED", "SKIPPED"] as const);

const SOURCES = new Set(["VACANCY", "CONTRACTOR", "CITY_SEAT"]);
const centerSource = z
  .string()
  .nullable()
  .transform((s) => {
    const up = s?.toUpperCase() ?? null;
    return (up && SOURCES.has(up) ? up : null) as GroupBroadcastCenterSource;
  })
  .catch(null);

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

const destinationSchema = z
  .object({
    groupJid: requiredText,
    groupName,
    city: text,
    uf: text,
    distanceKm: km,
    reason,
    status,
    errorCode: text,
    error: text,
    // Tolerância a um nome antigo do campo do motivo.
    errorMessage: text,
    sentAt: text,
  })
  .transform(({ errorMessage, ...d }): GroupBroadcastDestination => ({
    ...d,
    error: d.error ?? errorMessage,
  }));

const previewDestinationSchema = z.object({
  groupJid: requiredText,
  groupName,
  city: text,
  uf: text,
  distanceKm: km,
  reason,
});

const failedGroupSchema = z.object({ groupName, errorMessage: text });

const summaryShape = {
  total: count,
  sent: count,
  failedCount: count,
  failed: tolerantArray(failedGroupSchema),
  skipped: count,
  pending: count,
  ownCity: count,
  inRadius: count,
  fallback: count,
  vip: count,
};

const summarySchema = z.object(summaryShape).nullable().catch(null);

const roundSchema = z.object({
  roundId: z.string().min(1),
  mode,
  createdAt: requiredText,
  radiusKm: radius,
  centerSource,
  summary: summarySchema,
  destinations: tolerantArray(destinationSchema),
});

const broadcastsSchema = z.object({
  radiusKm: radius,
  groupBroadcastAt: text,
  inFlight: count,
  // Sem o campo, não bloqueia: quem decide de verdade é a API no POST.
  canResend: flag(true),
  resendBlockedReason: text,
  rounds: tolerantArray(roundSchema),
});

const previewSchema = z.object({
  radiusKm: radius,
  vacancyCity: text,
  vacancyUf: text,
  center: z.object({ source: centerSource }).catch({ source: null }),
  ownCityHasGroup: flag(true),
  fallbackUsed: flag(false),
  destinations: tolerantArray(previewDestinationSchema),
  skipped: tolerantArray(previewDestinationSchema),
  canResend: flag(true),
  resendBlockedReason: text,
});

const lastRoundSchema = z
  .object({ roundId: text, mode, at: z.string().min(1), ...summaryShape })
  .nullable()
  .catch(null);

// ─── Normalizadores (exportados para os testes e para o cliente da lista) ──

/** Resumo calculado das linhas, quando a API não manda `summary`. */
export function summarizeDestinations(
  destinations: GroupBroadcastDestination[],
): GroupBroadcastSummary {
  const tentados = destinations.filter((d) => d.status !== "SKIPPED");
  const by = (s: GroupDestinationStatus) => tentados.filter((d) => d.status === s);
  const falhas = by("FAILED");
  return {
    total: tentados.length,
    sent: by("SENT").length,
    failedCount: falhas.length,
    failed: falhas.slice(0, 3).map((d) => ({ groupName: d.groupName, errorMessage: d.error })),
    skipped: destinations.length - tentados.length,
    pending: by("PENDING").length + by("SENDING").length,
    ownCity: tentados.filter((d) => d.reason === "VACANCY_CITY").length,
    inRadius: tentados.filter((d) => d.reason === "RADIUS").length,
    fallback: tentados.filter((d) => d.reason === "FALLBACK").length,
    vip: tentados.filter((d) => d.reason === "VIP_STORE_GROUP").length,
  };
}

const VAZIO: VacancyGroupBroadcasts = {
  radiusKm: 0,
  groupBroadcastAt: null,
  inFlight: 0,
  canResend: true,
  resendBlockedReason: null,
  rounds: [],
};

export function parseVacancyGroupBroadcasts(raw: unknown): VacancyGroupBroadcasts {
  const parsed = broadcastsSchema.safeParse(raw ?? {});
  if (!parsed.success) return VAZIO;
  const rounds: GroupBroadcastRound[] = parsed.data.rounds.map((r) => ({
    ...r,
    summary: r.summary ?? summarizeDestinations(r.destinations),
  }));
  // "Mais nova primeiro" é o contrato; ordenar de novo não custa e protege a tela.
  rounds.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  return { ...parsed.data, rounds };
}

export function parseGroupBroadcastPreview(raw: unknown): GroupBroadcastPreview {
  const parsed = previewSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return {
      radiusKm: 0,
      vacancyCity: null,
      vacancyUf: null,
      centerSource: null,
      ownCityHasGroup: true,
      fallbackUsed: false,
      destinations: [],
      skipped: [],
      canResend: true,
      resendBlockedReason: null,
    };
  }
  const { center, ...rest } = parsed.data;
  return { ...rest, centerSource: center.source };
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

/** `error.code` da resposta da API (`{ error: { code, message } }`), quando houver. */
export function apiErrorCode(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  const code = (err.response?.data as { error?: { code?: unknown } } | undefined)?.error?.code;
  return typeof code === "string" ? code : null;
}

/**
 * A ROTA não existe (API antiga, anterior ao registro por grupo): a tela
 * degrada. Um 404 com código do domínio (`VACANCY_NOT_FOUND`,
 * `CONTRACTOR_NOT_FOUND`) é erro de verdade e não entra aqui.
 */
export function isRouteMissingError(err: unknown): boolean {
  if (!axios.isAxiosError(err) || err.response?.status !== 404) return false;
  const code = apiErrorCode(err);
  return code === null || code === "NOT_FOUND";
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

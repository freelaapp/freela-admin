import { isAxiosError } from "axios";
import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Cliente do "Onboarding" (aula obrigatória, `/v1/admins/orientation`). Respostas em
 * `{ data }`; erros em `{ error: { code, message } }`. Espelha o controller
 * `src/shared/provider-orientation/adapters/http/admins-orientation.controller.ts` da API.
 * Datas chegam como string ISO. Campos novos da API são opcionais: API velha sem o campo
 * não pode quebrar a tela.
 */
const api = createAuthedClient("/v1/admins/orientation");

export type OrientationGateMode = "OFF" | "NEW_ONLY" | "ALL";
export type OrientationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type OrientationSessionStatus = "OPEN" | "FINISHED" | "CANCELLED";
export type OrientationEnrollmentStatus =
  | "BOOKED"
  | "APPROVED"
  | "REJECTED"
  | "NO_SHOW"
  | "CANCELLED"
  | "MOVED";
export type OrientationSessionAlert = "LOW_BOOKINGS" | "NO_LINK_24H" | "ATTENDANCE_OPEN";
export type OrientationOrigin = "APP" | "WEB" | "TOKEN_LINK" | "ADMIN";
export type OrientationCancelReason = "BY_FREELANCER" | "BY_ADMIN" | "SESSION_CANCELLED";
export type OrientationMeetSource = "GOOGLE" | "MANUAL";
export type OrientationGoogleSyncStatus =
  | "NOT_CONNECTED"
  | "PENDING"
  | "SYNCING"
  | "SYNCED"
  | "FAILED"
  | "DELETE_PENDING";
export type AttendanceResult = "APPROVED" | "REJECTED" | "NO_SHOW";

export interface OrientationSettings {
  gateMode: OrientationGateMode;
  newSignupsSince: string | null;
  gateFixedJobs: boolean;
  defaultCapacity: number;
  maxCapacity: number;
  defaultDurationMin: number;
  bookingClosesMinBefore: number;
  maxChanges: number;
  maxNoShows: number;
  sessionsShown: number;
  joinOpensMinBefore: number;
  resultGraceMin: number;
  convocationMinDays: number;
  dailyMessageCap: number;
}

export interface OrientationSettingsView extends OrientationSettings {
  updatedAt?: string | null;
  updatedByAdminId?: string | null;
  updatedByAdminName?: string | null;
  /** Ausente = trava de vagas não ligada no servidor. */
  gateWired?: boolean;
}

/** Só campos do DTO: a API recusa (400) `newSignupsSince` e `updated*`. */
export type OrientationSettingsPatch = Partial<Omit<OrientationSettings, "newSignupsSince">>;

export interface OrientationSummary {
  generatedAt: string;
  gateMode: OrientationGateMode;
  cutoff: string;
  cutoffStamped: boolean;
  freelancers: {
    active: number;
    approved: number;
    rejected: number;
    withoutGlobal: number;
    pending: number;
    pendingSinceCutoff: number;
  };
  blockedByMode: Record<OrientationGateMode, number>;
  booked: number;
  queue: number;
  nextSession: { id: string; startsAt: string; bookedCount: number; capacity: number } | null;
}

export interface OrientationHost {
  id: string;
  name: string | null;
  email: string;
  /** Conta Google conectada e pronta. Ausente em API velha. */
  googleConnected?: boolean;
}

export interface OrientationSessionView {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  status: OrientationSessionStatus;
  hostAdminId: string;
  hostName: string | null;
  meetUrl: string | null;
  meetSource: OrientationMeetSource | null;
  googleSyncStatus: OrientationGoogleSyncStatus;
  googleSyncError: string | null;
  audience: { ufs: string[]; cities: string[] };
  seriesId: string | null;
  notes: string | null;
  alerts: OrientationSessionAlert[];
  finishedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
}

export interface OrientationEnrollee {
  enrollmentId: string;
  providerGlobalId: string;
  userId: string;
  status: string;
  origin: OrientationOrigin;
  bookedAt: string;
  notes: string | null;
  firstJoinClickAt: string | null;
  name: string | null;
  phone: string | null;
  city: string | null;
  uf: string | null;
  roles: string[];
  totalCompletedServices: number;
  previousNoShows: number;
  /** Opcional: API velha não manda. "SESSION_CANCELLED" = a turma foi cancelada. */
  cancelledReason?: OrientationCancelReason | null;
}

export type OrientationSessionDetail = OrientationSessionView & {
  enrollees: OrientationEnrollee[];
  reopenUntil?: string | null;
};

export interface CreateOrientationSessionInput {
  startsAt: string;
  durationMin?: number;
  capacity?: number;
  hostAdminId?: string;
  meetUrl?: string;
  audienceUfs?: string[];
  audienceCities?: string[];
  notes?: string;
}

export type UpdateOrientationSessionInput = Partial<CreateOrientationSessionInput>;

/** Sem `notes`: a API recusa o campo na série. */
export interface OrientationSeriesInput {
  weekdays: number[];
  time: string;
  fromDate: string;
  toDate: string;
  durationMin?: number;
  capacity?: number;
  hostAdminId?: string;
  meetUrl?: string;
  audienceUfs?: string[];
  audienceCities?: string[];
  skipDates?: string[];
  dryRun: boolean;
  seriesId?: string;
}

export interface OrientationSeriesResult {
  seriesId: string | null;
  sessions: { startsAt: string; isHoliday: boolean }[];
  alreadyCreated?: boolean;
}

export interface AttendanceMarkInput {
  enrollmentId: string;
  result: AttendanceResult;
  notes?: string;
}

export interface AttendancePreview {
  warnings: Array<{
    enrollmentId: string;
    futureAcceptedVacancies: Array<{
      vacancyId: string;
      startTime: string;
      title: string;
      contractorName: string | null;
    }>;
  }>;
}

export interface FinishResult {
  approved: number;
  rejected: number;
  noShow: number;
  unchanged: Array<{ enrollmentId: string; providerStatus: string }>;
}

export interface OrientationEnrollmentView {
  id: string;
  sessionId: string;
  providerGlobalId: string;
  status: OrientationEnrollmentStatus;
  origin: OrientationOrigin;
  bookedAt: string;
  startsAt: string;
  endsAt: string;
}

export interface OrientationEnrollmentRow {
  id: string;
  sessionId: string;
  status: OrientationEnrollmentStatus;
  origin: OrientationOrigin;
  bookedAt: string;
  resultAt: string | null;
  notes: string | null;
  cancelledReason: OrientationCancelReason | null;
  session: { startsAt: string; endsAt: string; status: OrientationSessionStatus };
}

export interface OrientationEventRow {
  id: string;
  action: string;
  actorType: "ADMIN" | "FREELANCER" | "SYSTEM";
  actorId: string | null;
  actorName?: string | null;
  detail: unknown;
  createdAt: string;
}

export interface OrientationProviderProfile {
  name: string | null;
  phone: string | null;
  city: string | null;
  uf: string | null;
  roles: string[];
  totalCompletedServices: number;
}

export interface OrientationProviderDetail {
  providerGlobalId: string;
  profile: OrientationProviderProfile | null;
  status: OrientationStatus;
  statusAt: string | null;
  approvedVia: string | null;
  noShows: number;
  changes: number;
  current: OrientationEnrollmentRow | null;
  enrollments: OrientationEnrollmentRow[];
  events: OrientationEventRow[];
}

// ----- configurações e painel -----

export async function getOrientationSettings(): Promise<OrientationSettingsView> {
  const res = await api.get("/settings");
  return res.data.data;
}

export async function updateOrientationSettings(
  patch: OrientationSettingsPatch,
): Promise<OrientationSettingsView> {
  const res = await api.put("/settings", patch);
  return res.data.data;
}

export async function getOrientationSummary(): Promise<OrientationSummary> {
  const res = await api.get("/summary");
  return res.data.data;
}

export async function getOrientationHosts(): Promise<OrientationHost[]> {
  const res = await api.get("/hosts");
  return res.data.data;
}

// ----- turmas -----

export async function listOrientationSessions(range: {
  from: string;
  to: string;
}): Promise<OrientationSessionView[]> {
  const res = await api.get("/sessions", { params: { from: range.from, to: range.to } });
  return res.data.data;
}

export async function getOrientationSession(id: string): Promise<OrientationSessionDetail> {
  const res = await api.get(`/sessions/${id}`);
  return res.data.data;
}

export async function createOrientationSession(
  input: CreateOrientationSessionInput,
): Promise<OrientationSessionView> {
  const res = await api.post("/sessions", input);
  return res.data.data;
}

export async function createOrientationSeries(
  input: OrientationSeriesInput,
): Promise<OrientationSeriesResult> {
  const res = await api.post("/sessions/series", input);
  return res.data.data;
}

export async function updateOrientationSession(
  id: string,
  patch: UpdateOrientationSessionInput,
): Promise<OrientationSessionView & { scheduleChanged: boolean }> {
  const res = await api.patch(`/sessions/${id}`, patch);
  return res.data.data;
}

export async function cancelOrientationSession(
  id: string,
  reason?: string,
): Promise<{ cancelledEnrollments: number }> {
  const res = await api.post(`/sessions/${id}/cancel`, { reason });
  return res.data.data;
}

export async function cancelOrientationSeries(
  seriesId: string,
  opts: { dryRun: boolean },
): Promise<{ sessions: number; cancelledEnrollments: number }> {
  const res = await api.post(`/series/${seriesId}/cancel`, { dryRun: opts.dryRun });
  return res.data.data;
}

// ----- chamada -----

export async function previewAttendance(
  id: string,
  marks: AttendanceMarkInput[],
): Promise<AttendancePreview> {
  const res = await api.post(`/sessions/${id}/attendance/preview`, { marks });
  return res.data.data;
}

export async function finishAttendance(
  id: string,
  marks: AttendanceMarkInput[],
): Promise<FinishResult> {
  const res = await api.post(`/sessions/${id}/finish`, { marks });
  return res.data.data;
}

export async function reopenAttendance(id: string): Promise<{ reopened: true }> {
  const res = await api.post(`/sessions/${id}/reopen`);
  return res.data.data;
}

// ----- pessoa -----

export async function getOrientationProvider(pgId: string): Promise<OrientationProviderDetail> {
  const res = await api.get(`/providers/${pgId}`);
  return res.data.data;
}

export async function getBookingLink(pgId: string): Promise<{ url: string; expiresAt: string }> {
  const res = await api.get(`/providers/${pgId}/booking-link`);
  return res.data.data;
}

export async function bookProvider(
  pgId: string,
  sessionId: string,
): Promise<OrientationEnrollmentView> {
  const res = await api.post(`/providers/${pgId}/book`, { sessionId });
  return res.data.data;
}

export async function rescheduleProvider(
  pgId: string,
  sessionId: string,
): Promise<OrientationEnrollmentView> {
  const res = await api.post(`/providers/${pgId}/reschedule`, { sessionId });
  return res.data.data;
}

export async function cancelProviderBooking(pgId: string): Promise<{ cancelled: boolean }> {
  const res = await api.post(`/providers/${pgId}/cancel-booking`);
  return res.data.data;
}

async function providerReason(pgId: string, path: string, reason: string): Promise<{ ok: true }> {
  const res = await api.post(`/providers/${pgId}/${path}`, { reason });
  return res.data.data;
}

export const approveWithoutClass = (pgId: string, reason: string) =>
  providerReason(pgId, "approve-manual", reason);
export const correctOrientationResult = (pgId: string, reason: string) =>
  providerReason(pgId, "correct-result", reason);
export const allowNewClass = (pgId: string, reason: string) =>
  providerReason(pgId, "allow-new-class", reason);
export const resetNoShows = (pgId: string, reason: string) =>
  providerReason(pgId, "reset-no-shows", reason);
export const resetChanges = (pgId: string, reason: string) =>
  providerReason(pgId, "reset-changes", reason);

// ----- fila (convocação) -----

export type QueueStatus = "PENDING" | "BOOKED" | "APPROVED" | "REJECTED";

/** Filtro da Fila. `activeWithinDays`: ausente = 30 (padrão da API); 0 = sem filtro de atividade. `signedUpFrom/To` = `YYYY-MM-DD` (dia de Brasília). */
export interface OrientationQueueFilter {
  status?: QueueStatus;
  uf?: string;
  city?: string;
  role?: string;
  signedUpFrom?: string;
  signedUpTo?: string;
  workedBefore?: boolean;
  activeWithinDays?: number;
  noShows?: "NONE" | "ANY";
  convoked?: "NEVER" | "EVER";
  notifyRequested?: boolean;
}

export interface QueueRow {
  providerGlobalId: string | null;
  userId: string;
  name: string | null;
  phone: string | null;
  city: string | null;
  uf: string | null;
  roles: string[];
  signedUpAt: string;
  totalCompletedServices: number;
  /** `YYYY-MM-DD` (Brasília). */
  lastActiveDay: string | null;
  noShows: number;
  lastConvokedAt: string | null;
  notifyRequestedAt: string | null;
  status: QueueStatus;
}

export interface QueueCounters {
  pending: { value: number; active: number; approved: number; rejected: number; booked: number };
  pendingActive30: { value: number; measuredSince: string | null };
  freeSeats4w: { value: number; sessions: number };
  weeksToServe: { value: number | null; perWeek: number };
  approved: { value: number };
}

export interface QueueCountersView {
  counters: QueueCounters;
  measuredSince?: string | null;
}

export interface QueueGroup {
  uf: string | null;
  count: number;
  cities: Array<{ city: string | null; count: number }>;
}

export interface QueueGroupsView {
  groups: QueueGroup[];
  /** Opcional: API velha não manda. true = o corte de 5.000 grupos escondeu os menores. */
  groupsTruncated?: boolean;
}

export interface QueuePeoplePage {
  rows: QueueRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QueueExport {
  rows: QueueRow[];
  total: number;
  truncated: boolean;
}

export interface ConvocationPreview {
  people: number;
  matching: number;
  withoutGlobal: number;
  places: Array<{ uf: string | null; city: string | null; count: number }>;
  freeSeats14d: number;
  plan: {
    days: number;
    perSeat: number | null;
    blocked: "NO_SEATS" | null;
    overbooked: boolean;
    requiresTypedCount: boolean;
  };
  pendingInQueue: number;
  dailyCap: number;
  channels: { messagesEnabled: boolean; whatsapp: boolean; push: true };
}

export interface ConvocationProgress {
  id: string;
  kind: "ADMIN" | "NOTIFY_REQUEST";
  createdAt: string;
  requestedByName: string | null;
  requestedCount: number;
  queued: number;
  sent: number;
  skipped: number;
  pending: number;
  parked: number;
}

export interface ConvocationInput {
  /** Obrigatório: a API recusa convocação sem filtro. */
  filter: OrientationQueueFilter;
  limit?: number;
  providerGlobalIds?: string[];
}

export type CreateConvocationInput = ConvocationInput & { requestKey: string; confirmCount?: number };

/** Tira o que é vazio (a API recusa string vazia em uf, por exemplo); mantém 0 e false. */
function queueParams(f: OrientationQueueFilter): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v as string | number | boolean;
  }
  return out;
}

export async function getOrientationQueue(f: OrientationQueueFilter): Promise<QueueGroupsView> {
  const res = await api.get("/queue", { params: queueParams(f) });
  return res.data.data;
}

/** Contadores do topo: não seguem o filtro (cache de 60 s no servidor). */
export async function getOrientationQueueCounters(): Promise<QueueCountersView> {
  const res = await api.get("/queue/counters");
  return res.data.data;
}

export async function getOrientationQueuePeople(
  f: OrientationQueueFilter,
  page: number,
  pageSize?: number,
): Promise<QueuePeoplePage> {
  const res = await api.get("/queue/people", {
    params: { ...queueParams(f), page, ...(pageSize ? { pageSize } : {}) },
  });
  return res.data.data;
}

/** Até 20.000 linhas. Limite de 3 por minuto no servidor (429). */
export async function exportOrientationQueue(f: OrientationQueueFilter): Promise<QueueExport> {
  const res = await api.get("/queue/export", { params: queueParams(f) });
  return res.data.data;
}

export async function previewConvocation(input: ConvocationInput): Promise<ConvocationPreview> {
  const res = await api.post("/queue/convocations", {
    ...input,
    filter: queueParams(input.filter),
    dryRun: true,
  });
  return res.data.data;
}

export async function createConvocation(
  input: CreateConvocationInput,
): Promise<{ convocationId: string; queued: number }> {
  const res = await api.post("/queue/convocations", {
    ...input,
    filter: queueParams(input.filter),
  });
  return res.data.data;
}

export async function listConvocations(): Promise<ConvocationProgress[]> {
  const res = await api.get("/queue/convocations");
  return res.data.data;
}

// ----- virada: aprovar por histórico e conferências do modo "Todos" -----

/** Espelha `HistoryCriteria` da API (V1). */
export interface HistoryCriteria {
  /** Inteiro de 1 a 1000. */
  minCompletedServices: number;
  /** De 0 a 5, passo 0,1. */
  minRating: number;
}

export interface HistorySampleRow {
  providerGlobalId: string;
  name: string | null;
  city: string | null;
  uf: string | null;
  totalCompletedServices: number;
  averageRating: number;
}

/** Espelha `HistoryPreview` da API (V1). */
export interface HistoryPreview {
  eligible: number;
  withBooking: number;
  noRatings: number;
  lowRating: number;
  alreadyApproved: number;
  rejected: number;
  sample: HistorySampleRow[];
  formula: string;
  formulas: {
    eligible: string;
    withBooking: string;
    noRatings: string;
    lowRating: string;
    alreadyApproved: string;
    rejected: string;
  };
  source: string;
}

export interface ReadinessCity {
  uf: string | null;
  city: string | null;
  openVacancies: number;
  approvedRecentApplicants: number;
  ok: boolean;
}

/** Espelha `Readiness` da API (V2). */
export interface Readiness {
  generatedAt?: string;
  appMinimum: { value: string | null; required: string; ok: boolean; source: string };
  supply: {
    windowDays: number;
    recentDays: number;
    cities: ReadinessCity[];
    openWithoutCity: number;
    citiesWithGap: number;
    ok: boolean;
    formula: string;
    source: string;
  };
}

export async function previewHistoryApproval(c: HistoryCriteria): Promise<HistoryPreview> {
  const res = await api.post("/history-approval", {
    minCompletedServices: c.minCompletedServices,
    minRating: c.minRating,
    dryRun: true,
  });
  return res.data.data;
}

export async function applyHistoryApproval(
  i: HistoryCriteria & { reason: string; confirmCount: number },
): Promise<{ batchId: string; approved: number; skipped: number }> {
  const res = await api.post("/history-approval", {
    minCompletedServices: i.minCompletedServices,
    minRating: i.minRating,
    dryRun: false,
    reason: i.reason,
    confirmCount: i.confirmCount,
  });
  return res.data.data;
}

/** 404 = API velha sem a rota: `null` (a tela mostra "Não deu para conferir"). 503 e o resto passam como erro. */
export async function getOrientationReadiness(): Promise<Readiness | null> {
  try {
    const res = await api.get("/readiness");
    return res.data.data;
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

// ----- conta Google (etapa 6) -----

export type GoogleCalendarScope = "app.created" | "events.owned" | "events";

/** Espelho de `GoogleConnectionView` da API (datas como string). */
export interface GoogleConnectionView {
  enabled: boolean;
  configured: boolean;
  scope: GoogleCalendarScope;
  connection: null | {
    googleEmail: string | null;
    status: "ACTIVE" | "REVOKED" | "ERROR";
    lastError: string | null;
    connectedAt: string;
    calendarMode: "SECONDARY" | "PRIMARY";
  };
}

/** 404 = API sem as rotas do Google: devolve `null` e o cartão some. */
export async function getGoogleConnection(): Promise<GoogleConnectionView | null> {
  try {
    const res = await api.get("/google/connection");
    return res.data.data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

export async function startGoogleConnect(): Promise<{ url: string }> {
  const res = await api.post("/google/connect");
  return res.data.data;
}

export async function completeGoogleConnect(input: {
  code: string;
  state: string;
}): Promise<GoogleConnectionView> {
  const res = await api.post("/google/callback", { code: input.code, state: input.state });
  return res.data.data;
}

export async function disconnectGoogle(): Promise<{ revokedAtGoogle: boolean }> {
  const res = await api.delete("/google/connection");
  return res.data.data;
}

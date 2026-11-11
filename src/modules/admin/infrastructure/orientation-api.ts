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
  meetUrl: string;
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
  meetUrl: string;
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
  actorType: string;
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

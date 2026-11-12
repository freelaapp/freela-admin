"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  allowNewClass,
  applyHistoryApproval,
  completeGoogleConnect,
  disconnectGoogle,
  getGoogleConnection,
  startGoogleConnect,
  approveWithoutClass,
  bookProvider,
  cancelOrientationSeries,
  cancelOrientationSession,
  cancelProviderBooking,
  correctOrientationResult,
  createOrientationSeries,
  createConvocation,
  createOrientationSession,
  exportOrientationQueue,
  finishAttendance,
  getBookingLink,
  getOrientationHosts,
  getOrientationProvider,
  getOrientationQueue,
  getOrientationReadiness,
  getOrientationQueueCounters,
  getOrientationQueuePeople,
  getOrientationSession,
  getOrientationSettings,
  getOrientationSummary,
  listConvocations,
  listOrientationSessions,
  previewAttendance,
  previewConvocation,
  previewHistoryApproval,
  reopenAttendance,
  rescheduleProvider,
  resetChanges,
  resetNoShows,
  updateOrientationSession,
  updateOrientationSettings,
  type AttendanceMarkInput,
  type ConvocationInput,
  type CreateConvocationInput,
  type CreateOrientationSessionInput,
  type HistoryCriteria,
  type OrientationQueueFilter,
  type OrientationSeriesInput,
  type OrientationSettingsPatch,
  type UpdateOrientationSessionInput,
} from "../infrastructure/orientation-api";

export const ORIENTATION_QUERY_ROOT = ["admin", "orientation"] as const;
const PROVIDERS_ROOT = ["admin", "providers"] as const;

const KEYS = {
  settings: [...ORIENTATION_QUERY_ROOT, "settings"] as const,
  summary: [...ORIENTATION_QUERY_ROOT, "summary"] as const,
  hosts: [...ORIENTATION_QUERY_ROOT, "hosts"] as const,
  google: [...ORIENTATION_QUERY_ROOT, "google"] as const,
  sessions: (from: string, to: string) => [...ORIENTATION_QUERY_ROOT, "sessions", from, to] as const,
  session: (id: string) => [...ORIENTATION_QUERY_ROOT, "session", id] as const,
  queue: (f: OrientationQueueFilter) => [...ORIENTATION_QUERY_ROOT, "queue", f] as const,
  queueCounters: [...ORIENTATION_QUERY_ROOT, "queue-counters"] as const,
  queuePeople: (f: OrientationQueueFilter, page: number) =>
    [...ORIENTATION_QUERY_ROOT, "queue-people", f, page] as const,
  convocations: [...ORIENTATION_QUERY_ROOT, "convocations"] as const,
  readiness: [...ORIENTATION_QUERY_ROOT, "readiness"] as const,
  provider: (pgId: string | null) => [...ORIENTATION_QUERY_ROOT, "provider", pgId] as const,
};

export function useOrientationSettings() {
  return useQuery({ queryKey: KEYS.settings, queryFn: getOrientationSettings });
}

export function useOrientationSummary(enabled = true) {
  return useQuery({
    queryKey: KEYS.summary,
    queryFn: getOrientationSummary,
    enabled,
    staleTime: 60_000,
  });
}

export function useOrientationHosts() {
  return useQuery({ queryKey: KEYS.hosts, queryFn: getOrientationHosts, staleTime: 5 * 60_000 });
}

export function useOrientationSessions(range: { from: string; to: string }) {
  return useQuery({
    queryKey: KEYS.sessions(range.from, range.to),
    queryFn: () => listOrientationSessions(range),
  });
}

export function useOrientationSession(id: string | null) {
  return useQuery({
    queryKey: KEYS.session(id ?? ""),
    queryFn: () => getOrientationSession(id as string),
    enabled: !!id,
  });
}

export function useOrientationProvider(pgId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: KEYS.provider(pgId),
    queryFn: () => getOrientationProvider(pgId as string),
    enabled: enabled && !!pgId,
  });
}

export function useOrientationQueue(f: OrientationQueueFilter) {
  return useQuery({ queryKey: KEYS.queue(f), queryFn: () => getOrientationQueue(f) });
}

/** Contadores do topo (não seguem o filtro; o servidor guarda 60 s). */
export function useOrientationQueueCounters() {
  return useQuery({
    queryKey: KEYS.queueCounters,
    queryFn: getOrientationQueueCounters,
    staleTime: 60_000,
  });
}

export function useOrientationQueuePeople(f: OrientationQueueFilter, page: number, enabled = true) {
  return useQuery({
    queryKey: KEYS.queuePeople(f, page),
    queryFn: () => getOrientationQueuePeople(f, page),
    enabled,
    placeholderData: (prev) => prev,
  });
}

/** Acompanha o envio: relê a cada 30 s enquanto houver gente esperando. */
export function useOrientationConvocations() {
  return useQuery({
    queryKey: KEYS.convocations,
    queryFn: listConvocations,
    refetchInterval: (q) => (q.state.data?.some((c) => c.pending > 0) ? 30_000 : false),
  });
}

/** Mutation que, ao terminar (certo ou errado), relê tudo do Onboarding (e, se pedido, a lista de freelancers). */
function useInvalidatingMutation<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  opts: { providers?: boolean } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ORIENTATION_QUERY_ROOT });
      if (opts.providers) void qc.invalidateQueries({ queryKey: PROVIDERS_ROOT });
    },
  });
}

export function useUpdateOrientationSettings() {
  return useInvalidatingMutation((patch: OrientationSettingsPatch) => updateOrientationSettings(patch));
}

export function useCreateOrientationSession() {
  return useInvalidatingMutation((input: CreateOrientationSessionInput) => createOrientationSession(input));
}

export function useCreateOrientationSeries() {
  return useInvalidatingMutation((input: OrientationSeriesInput) => createOrientationSeries(input));
}

export function useUpdateOrientationSession() {
  return useInvalidatingMutation((v: { id: string; patch: UpdateOrientationSessionInput }) =>
    updateOrientationSession(v.id, v.patch),
  );
}

export function useCancelOrientationSession() {
  return useInvalidatingMutation(
    (v: { id: string; reason?: string }) => cancelOrientationSession(v.id, v.reason),
    { providers: true },
  );
}

/** Só conta (dryRun): não relê nada. */
export function useCountSeriesCancellation() {
  return useMutation({
    mutationFn: (seriesId: string) => cancelOrientationSeries(seriesId, { dryRun: true }),
  });
}

export function useCancelOrientationSeries() {
  return useInvalidatingMutation(
    (v: { seriesId: string; dryRun: boolean }) => cancelOrientationSeries(v.seriesId, { dryRun: v.dryRun }),
    { providers: true },
  );
}

/** Só leitura: não relê o Onboarding (senão cada marca refaz as listas e a poda). */
export function usePreviewAttendance(id: string) {
  return useMutation({ mutationFn: (marks: AttendanceMarkInput[]) => previewAttendance(id, marks) });
}

export function useFinishAttendance(id: string) {
  return useInvalidatingMutation((marks: AttendanceMarkInput[]) => finishAttendance(id, marks), {
    providers: true,
  });
}

export function useReopenAttendance(id: string) {
  return useInvalidatingMutation(() => reopenAttendance(id), { providers: true });
}

export function useBookingLink() {
  return useInvalidatingMutation((providerGlobalId: string) => getBookingLink(providerGlobalId));
}

export type OrientationProviderActionInput = {
  kind:
    | "book"
    | "reschedule"
    | "cancel-booking"
    | "approve-manual"
    | "correct-result"
    | "allow-new-class"
    | "reset-no-shows"
    | "reset-changes";
  providerGlobalId: string;
  sessionId?: string;
  reason?: string;
};

function runProviderAction(v: OrientationProviderActionInput): Promise<unknown> {
  const { providerGlobalId: pg, sessionId = "", reason = "" } = v;
  switch (v.kind) {
    case "book":
      return bookProvider(pg, sessionId);
    case "reschedule":
      return rescheduleProvider(pg, sessionId);
    case "cancel-booking":
      return cancelProviderBooking(pg);
    case "approve-manual":
      return approveWithoutClass(pg, reason);
    case "correct-result":
      return correctOrientationResult(pg, reason);
    case "allow-new-class":
      return allowNewClass(pg, reason);
    case "reset-no-shows":
      return resetNoShows(pg, reason);
    case "reset-changes":
      return resetChanges(pg, reason);
  }
}

export function useOrientationProviderAction() {
  return useInvalidatingMutation(runProviderAction, { providers: true });
}

/** Só leitura (dryRun): não relê nada. */
export function usePreviewConvocation() {
  return useMutation({ mutationFn: (input: ConvocationInput) => previewConvocation(input) });
}

export function useCreateConvocation() {
  return useInvalidatingMutation((input: CreateConvocationInput) => createConvocation(input));
}

/** Exportação: só leitura (grava o registro no servidor, nada a reler). */
export function useExportOrientationQueue() {
  return useMutation({ mutationFn: (f: OrientationQueueFilter) => exportOrientationQueue(f) });
}

/** Só leitura (dryRun): mutação, não consulta. Cada clique em "Ver quantos" é uma conta nova. */
export function useHistoryPreview() {
  return useMutation({ mutationFn: (c: HistoryCriteria) => previewHistoryApproval(c) });
}

/** Aprova por histórico: ao terminar relê resumo e fila (e a lista de freelancers). */
export function useApplyHistoryApproval() {
  return useInvalidatingMutation(
    (i: HistoryCriteria & { reason: string; confirmCount: number }) => applyHistoryApproval(i),
    { providers: true },
  );
}

/** Conferências do modo "Todos". Sem retry e sem cache longo: erro vira "Não deu para conferir". */
export function useOrientationReadiness(enabled: boolean) {
  return useQuery({
    queryKey: KEYS.readiness,
    queryFn: getOrientationReadiness,
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
}

// ----- conta Google (etapa 6) -----

export function useGoogleConnection() {
  return useQuery({ queryKey: KEYS.google, queryFn: getGoogleConnection, staleTime: 60_000 });
}

/** Só pede a URL de consentimento; quem navega é a tela. */
export function useStartGoogleConnect() {
  return useMutation({ mutationFn: startGoogleConnect });
}

function useGoogleMutation<TInput, TOutput>(fn: (input: TInput) => Promise<TOutput>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: KEYS.google });
      void qc.invalidateQueries({ queryKey: KEYS.hosts });
    },
  });
}

export function useCompleteGoogleConnect() {
  return useGoogleMutation(completeGoogleConnect);
}

export function useDisconnectGoogle() {
  return useGoogleMutation(() => disconnectGoogle());
}

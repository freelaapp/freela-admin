import { brasiliaDateKey, brasiliaDateTimeToIso } from "@/modules/admin/application/orientation-presentation";
import type {
  CreateOrientationSessionInput,
  OrientationSeriesInput,
  OrientationSessionView,
  UpdateOrientationSessionInput,
} from "@/modules/admin/infrastructure/orientation-api";

export type BuildResult<T> = { ok: true; payload: T } | { ok: false; error: string };

export interface SessionFormState {
  date: string;
  time: string;
  durationMin: string;
  capacity: string;
  hostAdminId: string;
  meetUrl: string;
  audienceUfs: string[];
  audienceCities: string[];
  notes: string;
}

/** Série: sem `notes` (a API recusa). */
export interface SeriesFormState {
  weekdays: number[];
  time: string;
  fromDate: string;
  toDate: string;
  durationMin: string;
  capacity: string;
  hostAdminId: string;
  meetUrl: string;
  audienceUfs: string[];
  audienceCities: string[];
}

export interface FormLimits {
  maxCapacity: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const INT_RE = /^\d+$/;
const MAX_DURATION_MIN = 480;
const MEET_ERROR = "Cole o link do Meet (https://…).";

const err = (error: string) => ({ ok: false as const, error });

function isHttpUrl(v: string): boolean {
  return /^https?:\/\/\S+$/i.test(v);
}

function parseDuration(raw: string): number | string | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  if (!INT_RE.test(v) || Number(v) < 1 || Number(v) > MAX_DURATION_MIN) {
    return `Duração: use um valor entre 1 e ${MAX_DURATION_MIN} minutos.`;
  }
  return Number(v);
}

function parseCapacity(raw: string, limits: FormLimits): number | string | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  if (!INT_RE.test(v) || Number(v) < 1 || Number(v) > limits.maxCapacity) {
    return `Lugares: use um valor entre 1 e ${limits.maxCapacity}.`;
  }
  return Number(v);
}

/** Hora (HH:mm) de Brasília do instante. */
export function brasiliaTimeOf(iso: string): string {
  return new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(11, 16);
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
}

export function sessionToForm(s: OrientationSessionView): SessionFormState {
  return {
    date: brasiliaDateKey(s.startsAt),
    time: brasiliaTimeOf(s.startsAt),
    durationMin: String(Math.round((new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 60000)),
    capacity: String(s.capacity),
    hostAdminId: s.hostAdminId,
    meetUrl: s.meetUrl ?? "",
    audienceUfs: s.audience.ufs,
    audienceCities: s.audience.cities,
    notes: s.notes ?? "",
  };
}

export function buildCreateSessionPayload(
  form: SessionFormState,
  limits: FormLimits,
  now: Date,
): BuildResult<CreateOrientationSessionInput> {
  if (!DATE_RE.test(form.date)) return err("Escolha o dia da aula.");
  if (!TIME_RE.test(form.time)) return err("Escolha o horário da aula.");
  const startsAt = brasiliaDateTimeToIso(form.date, form.time);
  if (new Date(startsAt).getTime() <= now.getTime()) {
    return err("Esse horário já passou. Escolha uma data e hora futuras.");
  }
  const meetUrl = form.meetUrl.trim();
  if (!isHttpUrl(meetUrl)) return err(MEET_ERROR);
  const durationMin = parseDuration(form.durationMin);
  if (typeof durationMin === "string") return err(durationMin);
  const capacity = parseCapacity(form.capacity, limits);
  if (typeof capacity === "string") return err(capacity);

  const payload: CreateOrientationSessionInput = { startsAt, meetUrl };
  if (durationMin !== undefined) payload.durationMin = durationMin;
  if (capacity !== undefined) payload.capacity = capacity;
  if (form.hostAdminId) payload.hostAdminId = form.hostAdminId;
  if (form.audienceUfs.length > 0) payload.audienceUfs = form.audienceUfs;
  if (form.audienceCities.length > 0) payload.audienceCities = form.audienceCities;
  const notes = form.notes.trim();
  if (notes) payload.notes = notes;
  return { ok: true, payload };
}

/** Edição: só o que mudou em relação à turma original. */
export function buildUpdateSessionPayload(
  form: SessionFormState,
  original: OrientationSessionView,
  limits: FormLimits,
): BuildResult<UpdateOrientationSessionInput> {
  const base = sessionToForm(original);
  const payload: UpdateOrientationSessionInput = {};

  if (form.date !== base.date || form.time !== base.time) {
    if (!DATE_RE.test(form.date)) return err("Escolha o dia da aula.");
    if (!TIME_RE.test(form.time)) return err("Escolha o horário da aula.");
    payload.startsAt = brasiliaDateTimeToIso(form.date, form.time);
  }
  if (form.durationMin.trim() !== base.durationMin) {
    const d = parseDuration(form.durationMin);
    if (typeof d === "string") return err(d);
    if (d !== undefined) payload.durationMin = d;
  }
  if (form.capacity.trim() !== base.capacity) {
    const c = parseCapacity(form.capacity, limits);
    if (typeof c === "string") return err(c);
    if (c !== undefined) {
      if (c < original.bookedCount) return err(`Já há ${original.bookedCount} inscritos nesta turma.`);
      payload.capacity = c;
    }
  }
  if (form.hostAdminId && form.hostAdminId !== base.hostAdminId) payload.hostAdminId = form.hostAdminId;
  const meetUrl = form.meetUrl.trim();
  if (meetUrl !== base.meetUrl) {
    if (!isHttpUrl(meetUrl)) return err(MEET_ERROR);
    payload.meetUrl = meetUrl;
  }
  if (!sameSet(form.audienceUfs, base.audienceUfs) || !sameSet(form.audienceCities, base.audienceCities)) {
    payload.audienceUfs = form.audienceUfs;
    payload.audienceCities = form.audienceCities;
  }
  if (form.notes.trim() !== base.notes.trim()) payload.notes = form.notes.trim();

  if (Object.keys(payload).length === 0) return err("Nada mudou.");
  return { ok: true, payload };
}

export function buildSeriesPayload(
  form: SeriesFormState,
  limits: FormLimits,
  opts: { dryRun: boolean; skipDates: string[]; seriesId: string },
): BuildResult<OrientationSeriesInput> {
  if (form.weekdays.length === 0) return err("Marque pelo menos um dia da semana.");
  if (!TIME_RE.test(form.time)) return err("Escolha o horário da aula.");
  if (!DATE_RE.test(form.fromDate)) return err("Escolha a data inicial.");
  if (!DATE_RE.test(form.toDate)) return err("Escolha a data final.");
  if (form.toDate < form.fromDate) return err("A data final vem antes da inicial.");
  const meetUrl = form.meetUrl.trim();
  if (!isHttpUrl(meetUrl)) return err(MEET_ERROR);
  const durationMin = parseDuration(form.durationMin);
  if (typeof durationMin === "string") return err(durationMin);
  const capacity = parseCapacity(form.capacity, limits);
  if (typeof capacity === "string") return err(capacity);

  const payload: OrientationSeriesInput = {
    weekdays: [...form.weekdays].sort((a, b) => a - b),
    time: form.time,
    fromDate: form.fromDate,
    toDate: form.toDate,
    meetUrl,
    dryRun: opts.dryRun,
    seriesId: opts.seriesId,
  };
  if (durationMin !== undefined) payload.durationMin = durationMin;
  if (capacity !== undefined) payload.capacity = capacity;
  if (form.hostAdminId) payload.hostAdminId = form.hostAdminId;
  if (form.audienceUfs.length > 0) payload.audienceUfs = form.audienceUfs;
  if (form.audienceCities.length > 0) payload.audienceCities = form.audienceCities;
  if (opts.skipDates.length > 0) payload.skipDates = opts.skipDates;
  return { ok: true, payload };
}

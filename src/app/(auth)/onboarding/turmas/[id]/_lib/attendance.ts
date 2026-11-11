import {
  formatSessionClock,
  formatSessionDay,
} from "@/modules/admin/application/orientation-presentation";
import type {
  AttendanceMarkInput,
  AttendanceResult,
  OrientationEnrollee,
  OrientationSessionDetail,
} from "@/modules/admin/infrastructure/orientation-api";

/** Marcas da chamada. Chave = `enrollmentId`. */
export type Marks = Record<string, { result: AttendanceResult; notes: string }>;

const RESULTS: readonly AttendanceResult[] = ["APPROVED", "REJECTED", "NO_SHOW"];

/** Só os inscritos que ainda estão `BOOKED`, por nome. */
export function bookedEnrollees(d: OrientationSessionDetail): OrientationEnrollee[] {
  return d.enrollees
    .filter((e) => e.status === "BOOKED")
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "pt-BR"));
}

/** Quem tocou em Entrar e ainda não tem marca vira Aprovado. */
export function approveJoined(m: Marks, booked: OrientationEnrollee[]): Marks {
  const next = { ...m };
  for (const e of booked) {
    if (!next[e.enrollmentId] && e.firstJoinClickAt) next[e.enrollmentId] = { result: "APPROVED", notes: "" };
  }
  return next;
}

/** Quem não tem marca vira Faltou. */
export function markRestNoShow(m: Marks, booked: OrientationEnrollee[]): Marks {
  const next = { ...m };
  for (const e of booked) {
    if (!next[e.enrollmentId]) next[e.enrollmentId] = { result: "NO_SHOW", notes: "" };
  }
  return next;
}

/** Descarta marca de quem saiu da lista. */
export function pruneMarks(m: Marks, booked: OrientationEnrollee[]): Marks {
  const ids = new Set(booked.map((e) => e.enrollmentId));
  return Object.fromEntries(Object.entries(m).filter(([id]) => ids.has(id)));
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Motivos que impedem encerrar (lista vazia = pode encerrar). */
export function finishBlockers(
  m: Marks,
  booked: OrientationEnrollee[],
  startsAt: string,
  now: Date,
): string[] {
  const blockers: string[] = [];
  const missing = booked.filter((e) => !m[e.enrollmentId]).length;
  if (missing > 0) {
    blockers.push(missing === 1 ? "Falta 1 pessoa" : `Faltam ${missing} pessoas`);
  }
  const noNote = booked.filter((e) => {
    const mark = m[e.enrollmentId];
    return mark?.result === "REJECTED" && mark.notes.trim() === "";
  });
  if (noNote.length > 0) {
    blockers.push(`Reprovado sem anotação: ${noNote.map((e) => e.name ?? "Sem nome").join(", ")}`);
  }
  if (now.getTime() < new Date(startsAt).getTime()) {
    blockers.push(`A aula ainda não começou (${formatSessionClock(startsAt)})`);
  }
  return blockers;
}

export function toFinishPayload(m: Marks): AttendanceMarkInput[] {
  return Object.entries(m).map(([enrollmentId, { result, notes }]) => {
    const note = notes.trim();
    return note ? { enrollmentId, result, notes: note } : { enrollmentId, result };
  });
}

/** "Encerrar chamada de segunda, 16/11, 9h: 18 aprovados, 2 não aprovados, 5 faltaram." */
export function finishSummary(startsAt: string, m: Marks): string {
  const count = (r: AttendanceResult) => Object.values(m).filter((x) => x.result === r).length;
  const a = count("APPROVED");
  const r = count("REJECTED");
  const f = count("NO_SHOW");
  return (
    `Encerrar chamada de ${formatSessionDay(startsAt)}, ${formatSessionClock(startsAt)}: ` +
    `${a} ${plural(a, "aprovado", "aprovados")}, ` +
    `${r} ${plural(r, "não aprovado", "não aprovados")}, ` +
    `${f} ${plural(f, "faltou", "faltaram")}.`
  );
}

// ----- rascunho no aparelho (sessionStorage) -----

const draftKey = (sessionId: string) => `orientation-attendance:${sessionId}`;

function isMarks(value: unknown): value is Marks {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((v) => {
    if (!v || typeof v !== "object") return false;
    const { result, notes } = v as { result?: unknown; notes?: unknown };
    return RESULTS.includes(result as AttendanceResult) && typeof notes === "string";
  });
}

export function loadDraft(storage: Storage, sessionId: string): Marks {
  try {
    const raw = storage.getItem(draftKey(sessionId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return isMarks(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function clearDraft(storage: Storage, sessionId: string): void {
  try {
    storage.removeItem(draftKey(sessionId));
  } catch {
    /* modo privado / cota: sem rascunho, a tela segue */
  }
}

export function saveDraft(storage: Storage, sessionId: string, m: Marks): void {
  if (Object.keys(m).length === 0) return clearDraft(storage, sessionId);
  try {
    storage.setItem(draftKey(sessionId), JSON.stringify(m));
  } catch {
    /* idem */
  }
}

import {
  brasiliaDateKey,
  formatSessionDay,
} from "@/modules/admin/application/orientation-presentation";
import type { OrientationSessionView } from "@/modules/admin/infrastructure/orientation-api";

/** Brasília é UTC−3 fixo (a API trata assim). */
const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function shortDate(utcMs: number): string {
  const d = new Date(utcMs);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

/** Semana de Brasília (segunda 00:00 a segunda seguinte 00:00) que contém `now`, deslocada em `offsetWeeks`. */
export function brasiliaWeek(
  now: Date,
  offsetWeeks: number,
): { fromIso: string; toIso: string; label: string } {
  const local = new Date(now.getTime() - BRASILIA_OFFSET_MS);
  const sinceMonday = (local.getUTCDay() + 6) % 7;
  const mondayLocalMs =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
    sinceMonday * DAY_MS +
    offsetWeeks * 7 * DAY_MS;
  const fromMs = mondayLocalMs + BRASILIA_OFFSET_MS;
  const toMs = fromMs + 7 * DAY_MS;
  return {
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(toMs).toISOString(),
    label: `${shortDate(mondayLocalMs)} a ${shortDate(mondayLocalMs + 6 * DAY_MS)}`,
  };
}

export interface SessionDayGroup {
  dayKey: string;
  label: string;
  sessions: OrientationSessionView[];
}

/** Agrupa por dia de Brasília, em ordem de horário. */
export function groupByBrasiliaDay(sessions: OrientationSessionView[]): SessionDayGroup[] {
  const sorted = [...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const groups: SessionDayGroup[] = [];
  for (const s of sorted) {
    const dayKey = brasiliaDateKey(s.startsAt);
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) last.sessions.push(s);
    else groups.push({ dayKey, label: formatSessionDay(s.startsAt), sessions: [s] });
  }
  return groups;
}

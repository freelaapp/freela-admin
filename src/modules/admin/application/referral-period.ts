/**
 * Período dos indicadores de Indicações, em dias de Brasília (UTC-3 fixo).
 *
 * A API de métricas recebe `YYYY-MM-DD` com o fim INCLUSIVO — mesmo contrato do
 * filtro do Dashboard. A lista de indicações recebe instantes (`Date` na API),
 * então o mesmo período vira `00:00`–`23:59:59.999` de Brasília com o fuso
 * explícito — sem ele "até 28/09" parava em 27/09 21:00.
 */

export type ReferralPeriodPreset = "7d" | "30d" | "this_month" | "last_month" | "all" | "custom";

export const REFERRAL_PERIOD_PRESETS: { id: ReferralPeriodPreset; label: string }[] = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "this_month", label: "Este mês" },
  { id: "last_month", label: "Mês passado" },
  { id: "all", label: "Tudo" },
  { id: "custom", label: "Personalizado" },
];

export interface ReferralPeriodSelection {
  preset: ReferralPeriodPreset;
  /** Só com `preset: "custom"`. `YYYY-MM-DD`; vazio = sem limite daquele lado. */
  customFrom: string;
  customTo: string;
}

/** Dias de Brasília. Lado ausente = sem limite. */
export interface ReferralDateRange {
  from?: string;
  to?: string;
}

const DAY_MS = 86_400_000;
const BRASILIA_OFFSET_MS = 3 * 3_600_000;

/** "YYYY-MM-DD" de hoje no fuso de Brasília. */
export function brasiliaToday(now: Date = new Date()): string {
  return new Date(now.getTime() - BRASILIA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Soma dias a uma data de calendário, sem passar por fuso. */
export function shiftDay(day: string, delta: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date) + delta * DAY_MS).toISOString().slice(0, 10);
}

export function resolveReferralPeriod(
  selection: ReferralPeriodSelection,
  now: Date = new Date(),
): ReferralDateRange {
  const today = brasiliaToday(now);
  const monthStart = `${today.slice(0, 7)}-01`;

  switch (selection.preset) {
    case "7d":
      return { from: shiftDay(today, -6), to: today };
    case "30d":
      return { from: shiftDay(today, -29), to: today };
    case "this_month":
      return { from: monthStart, to: today };
    case "last_month": {
      const lastDay = shiftDay(monthStart, -1);
      return { from: `${lastDay.slice(0, 7)}-01`, to: lastDay };
    }
    case "all":
      return {};
    case "custom": {
      const from = selection.customFrom || undefined;
      const to = selection.customTo || undefined;
      // Início depois do fim é engano de digitação, não período vazio.
      if (from && to && from > to) return { from: to, to: from };
      return { from, to };
    }
  }
}

/** O mesmo período como instantes, para a lista (`from`/`to` são `Date` na API). */
export function toInstantRange(range: ReferralDateRange): { from?: string; to?: string } {
  return {
    ...(range.from ? { from: `${range.from}T00:00:00.000-03:00` } : {}),
    ...(range.to ? { to: `${range.to}T23:59:59.999-03:00` } : {}),
  };
}

function toBr(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

export function describeReferralRange(range: ReferralDateRange): string {
  if (range.from && range.to) {
    return range.from === range.to ? toBr(range.from) : `${toBr(range.from)} a ${toBr(range.to)}`;
  }
  if (range.from) return `desde ${toBr(range.from)}`;
  if (range.to) return `até ${toBr(range.to)}`;
  return "todo o período";
}

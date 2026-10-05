/** Filtro Hoje / Este mês / Este ano / Personalizado, em dias de Brasília (UTC-3). */
export type CommissionPeriodPreset = "today" | "this_month" | "this_year" | "custom";

export const COMMISSION_PERIOD_PRESETS: { value: CommissionPeriodPreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "this_month", label: "Este mês" },
  { value: "this_year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
];

export interface CommissionPeriodSelection {
  preset: CommissionPeriodPreset;
  customFrom: string;
  customTo: string;
}

export function brasiliaToday(now: Date = new Date()): string {
  return new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export function resolveCommissionPeriod(
  selection: CommissionPeriodSelection,
  now: Date = new Date(),
): { from?: string; to?: string } {
  const today = brasiliaToday(now);
  switch (selection.preset) {
    case "today":
      return { from: today, to: today };
    case "this_month":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "this_year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "custom": {
      const from = selection.customFrom || undefined;
      const to = selection.customTo || undefined;
      if (from && to && from > to) return { from: to, to: from };
      return { from, to };
    }
  }
}

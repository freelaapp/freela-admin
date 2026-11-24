import {
  VACANCY_OUTCOME_KEYS,
  type AdminDashboard,
  type VacancyOutcomeKey,
} from "../../infrastructure/dashboard-api";

type ServiceDate = NonNullable<AdminDashboard["vacanciesByServiceDate"]>;

const ratio = (numerator: number, denominator: number) => ({
  value: denominator ? numerator / denominator : null,
  numerator,
  denominator,
});

const counts = (over: Partial<Record<VacancyOutcomeKey, number>>) =>
  Object.fromEntries(VACANCY_OUTCOME_KEYS.map((k) => [k, over[k] ?? 0])) as Record<
    VacancyOutcomeKey,
    number
  >;

const change = (absolute: number, percent: number | null) => ({ absolute, percent });

/** Janela de um dia só (Ontem): [16/11 00h, 17/11 00h) em Brasília. */
export const DAY_PERIOD = {
  preset: "yesterday",
  start: "2026-11-16T03:00:00.000Z",
  end: "2026-11-17T03:00:00.000Z",
  previousStart: "2026-11-15T03:00:00.000Z",
  previousEnd: "2026-11-16T03:00:00.000Z",
  label: "ontem",
  previousLabel: "anteontem",
};

/** Janela de vários dias (Este mês, mês inteiro). */
export const MONTH_PERIOD = {
  preset: "this_month",
  start: "2026-11-01T03:00:00.000Z",
  end: "2026-12-01T03:00:00.000Z",
  previousStart: "2026-10-01T03:00:00.000Z",
  previousEnd: "2026-11-01T03:00:00.000Z",
  label: "novembro/2026 (mês inteiro)",
  previousLabel: "outubro/2026 (mês inteiro)",
};

const group = (
  key: string,
  label: string,
  outcomes: string[],
  current: number,
  previous: number,
  chg: { absolute: number; percent: number | null } | null,
) => ({
  key,
  label,
  outcomes,
  current,
  previous,
  change: chg,
  shareOfTotal: { current: ratio(current, 10), previous: ratio(previous, 8) },
});

/** 10 vagas oficiais (anterior: 8), em 7 grupos que somam o total. */
export function serviceDateBlock(period = DAY_PERIOD): ServiceDate {
  return {
    base: "SERVICE_DATE",
    period,
    total: { current: 10, previous: 8, change: change(2, 25) },
    groups: [
      group("COMPLETED", "Concluídas", ["COMPLETED"], 6, 5, change(1, 20)),
      group("NO_SHOW", "Freelancer confirmou e não foi", ["NO_SHOW"], 1, 0, null),
      group("NO_FREELANCER", "Não fechadas por falta de freelancer", ["NO_FREELANCER"], 1, 1, change(0, 0)),
      group(
        "CANCELLED",
        "Canceladas",
        ["COMPANY_CANCELLED_AFTER_CHOOSING", "CHOSEN_NOT_PAID", "CANCELLED_BY_SUPPORT", "CANCELLED_BY_SYSTEM"],
        1,
        1,
        change(0, 0),
      ),
      group("HAPPENING_OR_CLOSING", "Em andamento ou aguardando encerrar", ["IN_PROGRESS", "SHIFT_ENDED_AWAITING_CLOSE"], 0, 0, null),
      group(
        "UPCOMING",
        "Ainda vão acontecer",
        ["PAID_AWAITING_START", "CHOSEN_AWAITING_PAYMENT", "OPEN_WITH_CANDIDATES", "OPEN_NO_CANDIDATES"],
        1,
        1,
        change(0, 0),
      ),
      group("OUT_OF_PATTERN", "Fora do padrão", ["OTHER"], 0, 0, null),
    ],
    groupsSum: { current: 10, previous: 8 },
    fake: { current: 3, previous: 2, change: change(1, 50) },
    test: { current: 1, previous: 0, change: null },
    grossTotal: { current: 14, previous: 10 },
    coveredNoShows: { current: 2, previous: 0, change: null },
    candidatesPerVacancy: {
      current: ratio(168, 10),
      previous: ratio(120, 8),
      change: change(1.8, 12),
    },
    byOutcome: {
      current: counts({
        COMPLETED: 6,
        NO_SHOW: 1,
        NO_FREELANCER: 1,
        CANCELLED_BY_SUPPORT: 1,
        OPEN_WITH_CANDIDATES: 1,
        FAKE_QUICK: 2,
        FAKE_DELETED: 1,
        TEST_QA: 1,
      }),
      previous: counts({
        COMPLETED: 5,
        NO_FREELANCER: 1,
        CANCELLED_BY_SYSTEM: 1,
        OPEN_NO_CANDIDATES: 1,
        FAKE_QUICK: 2,
      }),
    },
  };
}

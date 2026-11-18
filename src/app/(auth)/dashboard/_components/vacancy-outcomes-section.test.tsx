import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  VACANCY_OUTCOME_KEYS,
  type AdminDashboard,
  type VacancyOutcomeKey,
} from "@/modules/admin/infrastructure/dashboard-api";
import { VacancyOutcomesSection } from "./vacancy-outcomes-section";

const counts = (over: Partial<Record<VacancyOutcomeKey, number>>) =>
  Object.fromEntries(
    VACANCY_OUTCOME_KEYS.map((k) => [k, over[k] ?? 0]),
  ) as Record<VacancyOutcomeKey, number>;

const base: AdminDashboard = {
  generatedAt: "2026-11-17T13:00:00.000Z",
  period: {
    preset: "this_month",
    start: "2026-11-01T03:00:00.000Z",
    end: "2026-11-17T13:00:00.000Z",
    previousStart: "2026-10-01T03:00:00.000Z",
    previousEnd: "2026-10-17T13:00:00.000Z",
    label: "novembro/2026 até agora",
    previousLabel: "01/10 a 17/10",
  },
  totals: {},
  indicators: {},
  topContractors: [],
};

const noShow = {
  occurrences: 2,
  people: 2,
  vacancies: 2,
  noWarning: 1,
  lateWithdrawal: 1,
  contested: 0,
  warnedWithdrawals: 1,
  notConfirmed: 0,
};

const data: AdminDashboard = {
  ...base,
  vacancyOutcomes: {
    quickCancelMinutes: 60,
    current: {
      total: 10,
      official: 7,
      fake: 2,
      test: 1,
      byOutcome: counts({
        COMPLETED: 6,
        NO_SHOW: 1,
        FAKE_QUICK: 2,
        TEST_QA: 1,
      }),
      officialCandidates: 0,
    },
    previous: {
      total: 0,
      official: 0,
      fake: 0,
      test: 0,
      byOutcome: counts({}),
      officialCandidates: 0,
    },
    previousRule: { vacanciesCreated: 9, endedWithoutProvider: 0 },
  },
  noShows: {
    current: noShow,
    previous: noShow,
    change: { absolute: 0, percent: 0 },
  },
};

describe("VacancyOutcomesSection", () => {
  it("mostra o destino das vagas, as falsas em cards separados e as faltas", () => {
    render(<VacancyOutcomesSection data={data} />);
    for (const title of [
      "Destino das vagas criadas",
      "Vagas falsas (fora dos números oficiais)",
      "Faltas: freelancer chamado e não foi",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(
      screen.getByText("7 oficiais · 2 falsas · 1 de teste"),
    ).toBeInTheDocument();
    expect(screen.getByText("Abertas e fechadas rápido")).toBeInTheDocument();
    expect(
      screen.getByText("Tinha candidatos e a empresa deixou passar"),
    ).toBeInTheDocument();
    expect(screen.getByText("2 pessoas em 2 vagas")).toBeInTheDocument();
  });

  it('cada linha das oficiais abre o "?" com o que é e a conta', () => {
    render(<VacancyOutcomesSection data={data} />);
    const group = screen.getByRole("heading", {
      name: "Aconteceram ou estão acontecendo",
    }).parentElement!.parentElement as HTMLElement;
    const row = within(group)
      .getByText("Concluídas")
      .closest("details") as HTMLElement;
    fireEvent.click(within(row).getByText("Concluídas"));
    expect(row).toHaveAttribute("open");
    expect(within(row).getByText(/6 de 7 vagas oficiais/)).toBeInTheDocument();
  });

  it("API sem os blocos novos: só o aviso", () => {
    render(<VacancyOutcomesSection data={base} />);
    expect(
      screen.getByText(/aparecem aqui\s+quando a API for atualizada/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Destino das vagas criadas" }),
    ).toBeNull();
  });
});

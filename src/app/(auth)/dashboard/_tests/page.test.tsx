import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardUnavailableError } from "@/modules/admin/infrastructure/dashboard-api";

const state = vi.hoisted(() => ({
  dashboard: {} as Record<string, unknown>,
  stages: {} as Record<string, unknown>,
  stagesScopes: [] as string[],
}));

vi.mock("@/modules/admin/application/use-admin-dashboard", () => ({
  useAdminDashboard: () => state.dashboard,
  useVacancyStages: (scope: string) => {
    state.stagesScopes.push(scope);
    return state.stages;
  },
}));

import DashboardPage from "../page";
import { serviceDateBlock } from "@/modules/admin/application/dashboard-service-date.fixture";

const ratio = (numerator: number, denominator: number) => ({
  value: denominator ? numerator / denominator : null,
  numerator,
  denominator,
});

const dashboard = {
  generatedAt: "2026-11-17T13:00:00.000Z",
  period: {
    preset: "this_month",
    start: "2026-11-01T03:00:00.000Z",
    end: "2026-11-17T13:00:00.000Z",
    previousStart: "2026-10-01T03:00:00.000Z",
    previousEnd: "2026-10-17T13:00:00.000Z",
    label: "novembro/2026 até agora",
    previousLabel: "01/10/2026 a 17/10/2026, até a mesma hora",
  },
  exclusions: { excludedAccounts: 1, qaServiceType: "teste" },
  totals: { freelancers: 1200, contractors: 85, platformRevenueCents: 1234567 },
  indicators: {
    contractorActivation: { current: ratio(12, 37), previous: ratio(10, 30), change: { absolute: 0.0, percent: 0 } },
  },
  topContractors: [
    {
      position: 1,
      contractorUserId: "u1",
      name: "Bar do Zé",
      city: "Jundiaí",
      uf: "SP",
      vacanciesCreated: 5,
      vacanciesCompleted: 4,
      hiresCompleted: 6,
      amountCents: 150000,
    },
  ],
};

const summary = (count: number, alerts = 0, vacancies: unknown[] = []) => ({
  count,
  alerts,
  vacancies,
  truncated: false,
});

const stages = {
  generatedAt: "2026-11-17T13:00:00.000Z",
  scope: "today",
  dayStart: "2026-11-17T03:00:00.000Z",
  dayEnd: "2026-11-18T03:00:00.000Z",
  stages: {
    S1: summary(2, 1),
    S2: summary(1, 1, [
      {
        id: "v1",
        module: "BARS_RESTAURANTS",
        title: "Garçom",
        serviceType: "garcom",
        contractorName: "Bar do Zé",
        city: "Jundiaí",
        startTime: "2026-11-17T22:00:00.000Z",
        endTime: "2026-11-18T03:00:00.000Z",
        stage: "S2",
        alert: true,
      },
    ]),
    S3: summary(1),
    S4: summary(0),
    S5: summary(0),
    S6: summary(0),
    S7: summary(3),
  },
};

describe("Dashboard novo", () => {
  beforeEach(() => {
    state.dashboard = { data: dashboard, isLoading: false, isError: false, error: null, isFetching: false };
    state.stages = { data: stages, isLoading: false, isError: false, error: null, isFetching: false };
    state.stagesScopes = [];
  });

  it("mostra os totais desde o início, os grupos do período e o Top 10", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Total de freelancers cadastrados")).toBeInTheDocument();
    expect(screen.getByText("1.200")).toBeInTheDocument();
    expect(screen.getAllByText("Desde o início")).toHaveLength(3);
    for (const title of ["Cadastros", "Vagas", "Conversão e recorrência", "Avaliações"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText("32,4%")).toBeInTheDocument();
    expect(screen.getByText("12 de 37 cadastrados")).toBeInTheDocument();
    // Indicador que a API não mandou: "—", nunca 0.
    const p3 = screen.getByText("Vagas criadas", { selector: "span" }).closest("div.rounded-xl") as HTMLElement;
    expect(within(p3).getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Bar do Zé", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Operação" })).toHaveAttribute("href", "/dashboard/operacao");
  });

  it("card de etapa abre a lista das vagas, com a definição e o alerta", () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole("button", { name: /S2\s*Vagas sem freelancer candidato/ }));
    const dialog = screen.getByText(/Entra quando:/).closest("div.rounded-lg") as HTMLElement;
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("menos de 24 h")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir" })).toHaveAttribute("href", "/jobs?vaga=v1");
  });

  it("o seletor de status troca para A acontecer sem mexer no período", () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole("button", { name: "A acontecer" }));
    expect(state.stagesScopes).toContain("upcoming");
    expect(screen.getByRole("button", { name: "Este mês" })).toHaveAttribute("aria-pressed", "true");
  });

  it("API sem as rotas novas: aviso com link para Operação, sem tela quebrada", () => {
    const unavailable = new DashboardUnavailableError();
    state.dashboard = { data: undefined, isLoading: false, isError: true, error: unavailable, isFetching: false };
    state.stages = { data: undefined, isLoading: false, isError: true, error: unavailable, isFetching: false };
    render(<DashboardPage />);
    expect(screen.getByText("O dashboard novo ainda não chegou à API.")).toBeInTheDocument();
    expect(screen.getByText(/status das vagas ainda não estão disponíveis/)).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Operação" });
    expect(links.every((a) => a.getAttribute("href") === "/dashboard/operacao")).toBe(true);
  });

  it("com o bloco da data do serviço: Vagas do dia, um card por grupo e a frase do período", () => {
    state.dashboard = {
      data: { ...dashboard, vacanciesByServiceDate: serviceDateBlock() },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    };
    render(<DashboardPage />);
    const vagas = screen.getByRole("heading", { name: "Vagas" }).closest("section") as HTMLElement;
    expect(within(vagas).getByText("Vagas do dia")).toBeInTheDocument();
    expect(within(vagas).getByText("Freelancer confirmou e não foi")).toBeInTheDocument();
    expect(within(vagas).getByText("Concluídas")).toBeInTheDocument();
    expect(within(vagas).getByText("Média de freelancers por vaga")).toBeInTheDocument();
    expect(within(vagas).queryByText("Vagas concluídas")).toBeNull();
    expect(screen.getByText(/Vagas: pela data do serviço/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Destino das vagas do período" }),
    ).toBeInTheDocument();
  });

  it("sem o bloco (API antiga): tela como sempre, com a frase antiga", () => {
    render(<DashboardPage />);
    const vagas = screen.getByRole("heading", { name: "Vagas" }).closest("section") as HTMLElement;
    expect(within(vagas).getByText("Vagas concluídas")).toBeInTheDocument();
    expect(within(vagas).queryByText("Vagas do dia")).toBeNull();
    expect(screen.getByText(/cada indicador pela data do próprio evento/)).toBeInTheDocument();
    expect(screen.queryByText(/Vagas: pela data do serviço/)).toBeNull();
  });
});

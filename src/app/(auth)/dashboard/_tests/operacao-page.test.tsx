import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const metrics = vi.hoisted(() => ({
  totalFreelancers: 1200,
  activeFreelancers: 900,
  newFreelancersThisMonth: 37,
  freelancersByRole: [],
  totalCompanies: 85,
  activeCompanies: 80,
  newCompaniesThisMonth: 8,
  topCompanies: [],
  openVacancies: 3,
  closedVacancies: 10,
  cancelledVacancies: 2,
  scheduledJobs: 1,
  inProgressJobs: 0,
  completedJobs: 30,
  cancelledJobs: 1,
  jobsByCity: [],
  jobsByMonth: [],
  pendingCandidacies: 4,
  acceptedCandidacies: 20,
  rejectedCandidacies: 2,
  totalUsers: 1300,
  activeUsers: 1250,
  newUsersThisMonth: 45,
  totalFeedbacks: 10,
  averageRating: 4.5,
  totalRevenue: 500000,
  pendingRepasses: 0,
  completedRepasses: 12,
  filterOptions: { cities: [], roles: [] },
  simplified: {
    currentMonth: "2026-11",
    previousMonth: "2026-10",
    contractors: { total: 85, newThisMonth: 8 },
    freelancers: { total: 1200, newThisMonth: 37 },
    vacanciesCreated: { current: 40, previous: 32 },
    openVacanciesWithoutProvider: 2,
    completedJobs: { current: 30, previous: 24, total: 300 },
    vacanciesCancelledWithoutProvider: { current: 4, previous: 8 },
    noShows: { current: 3, previous: 5, jobsScheduledCurrent: 40, jobsScheduledPrevious: 35 },
    platformRevenue: { current: 50000, previous: 40000, total: 900000, gmvCurrent: 300000 },
  },
}));

vi.mock("@/modules/admin/application/use-admin-metrics", () => ({
  useAdminMetrics: () => ({ data: metrics, isLoading: false, isError: false }),
}));
vi.mock("@/modules/auth/application/use-auth", () => ({
  useAuth: () => ({ hasPermission: () => false }),
}));
vi.mock("@/modules/admin/application/use-orientation", () => ({
  useOrientationSummary: () => ({ data: undefined }),
}));

import OperacaoPage from "../operacao/page";

// Os gráficos (recharts) medem o contêiner com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

describe("Página Operação (o que saiu do dashboard)", () => {
  it("mantém os indicadores antigos, inclusive o não comparecimento, e volta ao dashboard", () => {
    render(<OperacaoPage />);
    expect(screen.getByRole("heading", { name: "Operação" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar ao dashboard/ })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByText("Freelancer Não Compareceu")).toBeInTheDocument();
    expect(screen.getByText("Vagas em Aberto sem Freelancer")).toBeInTheDocument();
    expect(screen.getByText("Faturamento Total")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Este mês" })).toHaveAttribute("aria-pressed", "true");
  });
});

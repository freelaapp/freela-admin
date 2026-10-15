import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { VacancyItem } from "@/modules/admin/infrastructure/admin-api";

const state = vi.hoisted(() => ({
  vacancies: undefined as VacancyItem[] | undefined,
  isSuperAdmin: false,
}));
const { mutation } = vi.hoisted(() => ({
  mutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/modules/auth/application/use-auth", () => ({
  useAuth: () => ({ user: { name: "Suporte" }, isSuperAdmin: state.isSuperAdmin }),
}));
vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("@/modules/admin/application/use-admin-vacancies", () => ({
  useAdminVacancies: () => ({ data: state.vacancies, isLoading: false, isError: false, isFetching: false }),
}));
vi.mock("@/modules/admin/application/use-admin-contractors", () => ({ useAdminContractors: () => ({ data: [] }) }));
vi.mock("@/modules/admin/application/use-admin-consultants", () => ({ useAdminConsultants: () => ({ data: [] }) }));
vi.mock("@/modules/admin/application/use-issue-reports", () => ({ useOpenIssueReports: () => ({ data: [] }) }));
vi.mock("@/modules/admin/application/use-vacancy-candidacies", () => ({
  useConfirmCandidacy: mutation,
  useReinstateCandidacy: mutation,
  useAcceptCandidacy: mutation,
  useRestoreCandidacy: mutation,
  useVacancyCandidacies: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/modules/admin/application/use-vacancy-feedbacks", () => ({
  useVacancyFeedbacks: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/modules/admin/application/use-admin-cancel-vacancy", () => ({
  useAdminCancelVacancy: mutation,
  useAdminRestartVacancy: mutation,
  useFinalizeVacancy: mutation,
  getAxiosErrorMessage: () => "erro",
}));
vi.mock("@/modules/admin/application/use-admin-remove-candidacy", () => ({ useAdminRemoveCandidacy: mutation }));
vi.mock("@/modules/admin/application/use-vacancy-outreach", () => ({
  useVacancyOutreach: () => ({ enviados: new Map(), registros: new Map() }),
  useSendVacancyStageMessage: mutation,
  useResendVacancyGroupMessage: mutation,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

// Partes da tela com dados próprios: fora do escopo deste teste.
vi.mock("@/components/admin/vacancy/vacancy-candidacy-list", () => ({ VacancyCandidacyList: () => null }));
vi.mock("@/components/admin/vacancy/compatible-invite-section", () => ({ CompatibleInviteSection: () => null }));
vi.mock("@/components/admin/vacancy/vacancy-feedbacks-section", () => ({ VacancyFeedbacksSection: () => null }));
vi.mock("@/components/admin/vacancy/vacancy-price-history-section", () => ({ VacancyPriceHistorySection: () => null }));
vi.mock("@/components/admin/vacancy/issue-report-queue", () => ({ IssueReportQueue: () => null }));
vi.mock("@/components/admin/vacancy/issue-report-resolution", () => ({ IssueReportResolution: () => null }));
vi.mock("../_components/vacancy-board", () => ({ VacancyBoard: () => null }));
vi.mock("../_components/support-auto-settings-dialog", () => ({ SupportAutoSettingsDialog: () => null }));
vi.mock("../_components/vacancy-dispatch-cell", () => ({ VacancyDispatchCell: () => null }));
vi.mock("../_components/vacancy-documents-cell", () => ({ VacancyDocumentsCell: () => null }));
vi.mock("../_components/vacancy-group-broadcasts-section", () => ({ VacancyGroupBroadcastsSection: () => null }));
vi.mock("../_components/group-dispatch-badge", () => ({ GroupDispatchBadge: () => null }));
vi.mock("../_components/vacancy-roadmap", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  VacancyRoadmap: () => null,
}));

import JobsPage from "../page";

const vaga = (over: Partial<VacancyItem> = {}): VacancyItem => ({
  id: "vac-1",
  contractorId: "c1",
  title: "Garçom",
  description: null,
  serviceType: "Garçom",
  date: "2026-10-20T00:00:00.000Z",
  startTime: "2026-10-20T21:00:00.000Z",
  endTime: "2026-10-21T03:00:00.000Z",
  payment: 15000,
  address: "Juiz de Fora",
  cityId: null,
  status: "CLOSED",
  createdAt: "2026-10-10T12:00:00.000Z",
  contractorCompanyName: "Bar do Zé",
  providerId: "p-ana",
  providerName: "Ana Souza",
  providerPixKeys: [{ keyType: "CPF", keyValue: "111.111.111-11", isDefault: true }],
  candidacyCount: 2,
  ...over,
});

let client: QueryClient;
function ui() {
  return (
    <QueryClientProvider client={client}>
      <JobsPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  client = new QueryClient();
  state.vacancies = [vaga()];
  state.isSuperAdmin = false;
});

describe("Vagas Empresa — modal 'Detalhes da vaga'", () => {
  it("acompanha a lista: desvincular A e colocar B passa a mostrar B e a chave Pix de B", () => {
    const { rerender } = render(ui());
    fireEvent.click(screen.getAllByTitle("Ver")[0]);

    expect(screen.getByText("Detalhes da Vaga")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("111.111.111-11")).toBeInTheDocument();

    // A lista recarrega depois da troca (as mutations invalidam ["admin","vacancies"]).
    state.vacancies = [
      vaga({
        providerId: "p-bruno",
        providerName: "Bruno Lima",
        providerPixKeys: [{ keyType: "EMAIL", keyValue: "bruno@pix.com", isDefault: true }],
      }),
    ];
    rerender(ui());

    expect(screen.getByText("Detalhes da Vaga")).toBeInTheDocument();
    expect(screen.getByText("Bruno Lima")).toBeInTheDocument();
    expect(screen.getByText("bruno@pix.com")).toBeInTheDocument();
    expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument();
    expect(screen.queryByText("111.111.111-11")).not.toBeInTheDocument();
  });

  it("fecha quando a vaga some da lista, e não reabre sozinho quando ela volta", () => {
    const { rerender } = render(ui());
    fireEvent.click(screen.getAllByTitle("Ver")[0]);
    expect(screen.getByText("Detalhes da Vaga")).toBeInTheDocument();

    state.vacancies = [vaga({ id: "outra", contractorCompanyName: "Outro Bar" })];
    rerender(ui());
    expect(screen.queryByText("Detalhes da Vaga")).not.toBeInTheDocument();

    state.vacancies = [vaga()];
    rerender(ui());
    expect(screen.queryByText("Detalhes da Vaga")).not.toBeInTheDocument();
  });
});

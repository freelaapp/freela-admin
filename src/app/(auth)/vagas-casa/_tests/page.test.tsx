import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CasaVacancyItem } from "@/modules/admin/infrastructure/casa-vacancies-api";

const state = vi.hoisted(() => ({
  vacancies: undefined as CasaVacancyItem[] | undefined,
  isSuperAdmin: false,
  catalog: [] as Array<{ slug: string; name: string; aliases?: string[] }>,
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
vi.mock("@/modules/admin/application/use-admin-casa-vacancies", () => ({
  useAdminCasaVacancies: () => ({ data: state.vacancies, isLoading: false, isError: false, isFetching: false }),
}));
vi.mock("@/modules/admin/application/use-admin-consultants", () => ({ useAdminConsultants: () => ({ data: [] }) }));
vi.mock("@/modules/admin/application/use-issue-reports", () => ({ useOpenIssueReports: () => ({ data: [] }) }));
vi.mock("@/modules/admin/application/use-admin-catalog", () => ({
  useCatalogRoles: () => ({ data: state.catalog }),
}));
vi.mock("@/modules/admin/application/use-casa-vacancy-actions", () => ({
  useAdminRemoveCasaCandidacy: mutation,
  useAdminRestartCasaVacancy: mutation,
  useCasaVacancyCandidacies: () => ({ data: [], isLoading: false }),
  useCasaVacancyFeedbacks: () => ({ data: [], isLoading: false }),
  useConfirmCasaCandidacy: mutation,
  useReinstateCasaCandidacy: mutation,
  useAcceptCasaCandidacy: mutation,
  useRestoreCasaCandidacy: mutation,
}));
vi.mock("@/modules/admin/application/use-admin-cancel-casa-vacancy", () => ({
  useAdminCancelCasaVacancy: mutation,
}));
vi.mock("@/modules/admin/application/use-admin-cancel-vacancy", () => ({
  getAxiosErrorMessage: () => "erro",
}));
vi.mock("@/modules/admin/application/use-vacancy-outreach", () => ({
  useVacancyOutreach: () => ({ enviados: new Map(), registros: new Map() }),
  useSendVacancyStageMessage: mutation,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

// Partes da tela com dados próprios: fora do escopo deste teste.
vi.mock("@/components/admin/vacancy/vacancy-candidacy-list", () => ({ VacancyCandidacyList: () => null }));
vi.mock("@/components/admin/vacancy/vacancy-feedbacks-section", () => ({ VacancyFeedbacksSection: () => null }));
vi.mock("@/components/admin/vacancy/issue-report-queue", () => ({ IssueReportQueue: () => null }));
vi.mock("@/components/admin/vacancy/issue-report-resolution", () => ({ IssueReportResolution: () => null }));
vi.mock("@/components/shared/refund-type-selector", () => ({ RefundTypeSelector: () => null }));
vi.mock("../../jobs/_components/vacancy-board", () => ({ VacancyBoard: () => null }));
vi.mock("../../jobs/_components/vacancy-roadmap", () => ({ VacancyRoadmap: () => null }));
vi.mock("../../jobs/_components/vacancy-dispatch-cell", () => ({ VacancyDispatchCell: () => null }));
vi.mock("../../jobs/_components/vacancy-documents-cell", () => ({ VacancyDocumentsCell: () => null }));

import VagasCasaPage from "../page";

const vaga = (over: Partial<CasaVacancyItem> = {}): CasaVacancyItem => ({
  id: "vac-casa-1",
  contractorId: "c1",
  title: "Diarista",
  description: null,
  serviceType: "faxina-pesada",
  date: "2026-10-20T00:00:00.000Z",
  startTime: "2026-10-20T11:00:00.000Z",
  endTime: "2026-10-20T19:00:00.000Z",
  payment: 18000,
  address: "Rua Prates, 480, Bom Retiro, São Paulo/SP, 01121000",
  cityId: null,
  status: "OPEN",
  createdAt: "2026-10-10T12:00:00.000Z",
  contractorName: "Maria Lima",
  contractorCompanyName: null,
  freelancerAmountInCents: 15000,
  platformFeeInCents: 3000,
  candidacyCount: 1,
  ...over,
});

let client: QueryClient;
function ui() {
  return (
    <QueryClientProvider client={client}>
      <VagasCasaPage />
    </QueryClientProvider>
  );
}
const desktop = () => within(screen.getByTestId("data-table-desktop"));

beforeEach(() => {
  client = new QueryClient();
  state.vacancies = [vaga()];
  state.isSuperAdmin = false;
  state.catalog = [];
});

describe("Vagas Casa — lista: abrir a vaga pela linha", () => {
  it("clicar no nome da empresa (qualquer ponto da linha) abre os detalhes da vaga", () => {
    render(ui());
    expect(screen.queryByRole("button", { name: "Fechar" })).not.toBeInTheDocument();
    fireEvent.click(desktop().getByText("Maria Lima"));
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    expect(screen.getByText(/Maria Lima ·/)).toBeInTheDocument();
  });

  it("o cancelar da linha abre só o cancelamento, não os detalhes", () => {
    render(ui());
    fireEvent.click(desktop().getByRole("button", { name: "Cancelar a vaga de Maria Lima" }));
    expect(screen.getByText(/Motivo do cancelamento/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reiniciar (no-show)" })).not.toBeInTheDocument();
  });

  it("o 'Ver' fica junto do Status (coluna presa na direita) e abre os detalhes", () => {
    render(ui());
    const ver = desktop().getByRole("button", { name: "Ver a vaga de Maria Lima" });
    expect(ver.closest("td")).toHaveClass("md:sticky", "md:right-0");
    fireEvent.click(ver);
    expect(screen.getByRole("button", { name: "Reiniciar (no-show)" })).toBeInTheDocument();
  });
});

describe("Vagas Casa — lista mais baixa", () => {
  it("o endereço vem curto: bairro · cidade/UF e a rua embaixo; o completo fica no title", () => {
    render(ui());
    expect(desktop().getByText("Bom Retiro · São Paulo/SP")).toBeInTheDocument();
    expect(desktop().getByText("Rua Prates, 480")).toBeInTheDocument();
    expect(desktop().getByTitle("Rua Prates, 480, Bom Retiro, São Paulo/SP, 01121000")).toBeInTheDocument();
  });

  it("data e horário na mesma coluna (sai a coluna Horário)", () => {
    render(ui());
    const headers = desktop()
      .getAllByRole("columnheader")
      .map((th) => th.textContent?.trim());
    expect(headers).toContain("Data do serviço");
    expect(headers).not.toContain("Horário");
    expect(headers).not.toContain("Data");
  });

  it("serviço pelo nome do catálogo; fora dele, o slug com maiúsculas", () => {
    state.catalog = [{ slug: "faxina-pesada", name: "Faxina Pesada (pós-obra)" }];
    state.vacancies = [vaga(), vaga({ id: "vac-casa-2", serviceType: "passadeira-de-roupa", contractorName: "João" })];
    render(ui());
    expect(desktop().getByText("Faxina Pesada (pós-obra)")).toBeInTheDocument();
    expect(desktop().getByText("Passadeira De Roupa")).toBeInTheDocument();
  });

  it("abre pela data do serviço, mais recente primeiro (também com a coluna Consultor)", () => {
    state.isSuperAdmin = true;
    state.vacancies = [
      vaga({ id: "a", contractorName: "Casa Setembro", date: "2026-09-10T00:00:00.000Z" }),
      vaga({ id: "b", contractorName: "Casa Novembro", date: "2026-11-10T00:00:00.000Z" }),
      vaga({ id: "c", contractorName: "Casa Outubro", date: "2026-10-10T00:00:00.000Z" }),
    ];
    render(ui());
    const nomes = desktop()
      .getAllByText(/^Casa /)
      .map((el) => el.textContent);
    expect(nomes).toEqual(["Casa Novembro", "Casa Outubro", "Casa Setembro"]);
  });
});

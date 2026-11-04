import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VacancyItem } from "@/modules/admin/infrastructure/admin-api";

// "Divulgação nos grupos" aparecia 2, 3… vezes no modal da vaga (03/11/2026). As três seções
// por vaga (divulgação, convite e reservas) tinham a MESMA chave (o id da vaga) na mesma
// lista: quando a lista do modal mudava de forma com ele aberto (freelancer escolhido, vaga
// fechou), o React perdia uma cópia de vista e ela ficava na tela, uma a mais a cada vez.

const state = vi.hoisted(() => ({ vacancies: undefined as VacancyItem[] | undefined }));
const { mutation } = vi.hoisted(() => ({
  mutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/modules/auth/application/use-auth", () => ({
  useAuth: () => ({ user: { name: "Suporte" }, isSuperAdmin: false }),
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
  useConfirmPrestartByPhone: mutation,
  useVacancyCandidacies: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/modules/admin/application/use-admin-catalog", () => ({ useCatalogRoles: () => ({ data: [] }) }));
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

// As três seções por vaga viram marcadores: o que se conta é quantas vezes cada uma aparece.
vi.mock("../_components/vacancy-group-broadcasts-section", () => ({
  VacancyGroupBroadcastsSection: () => <section data-testid="secao-divulgacao" />,
}));
vi.mock("@/components/admin/vacancy/compatible-invite-section", () => ({
  CompatibleInviteSection: () => <section data-testid="secao-convite" />,
}));
vi.mock("@/components/admin/vacancy/vacancy-reserves-section", () => ({
  VacancyReservesSection: () => <section data-testid="secao-reservas" />,
}));
// Fluxo v2, fatia E: a rodada de seleção é a 4ª seção por vaga (chave `selecao-`).
vi.mock("@/components/admin/vacancy/vacancy-selection-round-section", () => ({
  VacancySelectionRoundSection: () => <section data-testid="secao-selecao" />,
}));

// O resto do modal, com dados próprios, fica fora deste teste.
vi.mock("@/components/admin/vacancy/vacancy-candidacy-list", () => ({ VacancyCandidacyList: () => null }));
vi.mock("@/components/admin/vacancy/vacancy-feedbacks-section", () => ({ VacancyFeedbacksSection: () => null }));
vi.mock("@/components/admin/vacancy/vacancy-price-history-section", () => ({ VacancyPriceHistorySection: () => null }));
vi.mock("@/components/admin/vacancy/issue-report-queue", () => ({ IssueReportQueue: () => null }));
vi.mock("@/components/admin/vacancy/issue-report-resolution", () => ({ IssueReportResolution: () => null }));
vi.mock("../_components/vacancy-board", () => ({ VacancyBoard: () => null }));
vi.mock("../_components/support-auto-settings-dialog", () => ({ SupportAutoSettingsDialog: () => null }));
vi.mock("../_components/vacancy-dispatch-cell", () => ({ VacancyDispatchCell: () => null }));
vi.mock("../_components/vacancy-documents-cell", () => ({ VacancyDocumentsCell: () => null }));
vi.mock("../_components/group-dispatch-badge", () => ({ GroupDispatchBadge: () => null }));
vi.mock("../_components/vacancy-roadmap", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  VacancyRoadmap: () => null,
}));

import JobsPage from "../page";

const EM_UMA_SEMANA = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();

// Vaga aberta, sem freelancer, com o turno por começar: o convite aparece.
const vagaAberta = (over: Partial<VacancyItem> = {}): VacancyItem => ({
  id: "vac-1",
  contractorId: "c1",
  title: "Garçom",
  description: null,
  serviceType: "Garçom",
  date: EM_UMA_SEMANA,
  startTime: EM_UMA_SEMANA,
  endTime: EM_UMA_SEMANA,
  payment: 15000,
  address: "Juiz de Fora",
  cityId: null,
  status: "OPEN",
  createdAt: "2026-10-10T12:00:00.000Z",
  contractorCompanyName: "Bar do Zé",
  providerId: null,
  providerName: null,
  providerPixKeys: [],
  candidacyCount: 2,
  ...over,
} as VacancyItem);

// A empresa escolheu a Ana: a vaga fecha e o bloco do freelancer aparece no topo do modal.
const vagaFechada = () =>
  vagaAberta({
    status: "CLOSED",
    providerId: "p-ana",
    providerName: "Ana Souza",
    providerPixKeys: [{ keyType: "CPF", keyValue: "111.111.111-11", isDefault: true }],
  });

let client: QueryClient;
function ui() {
  return (
    <QueryClientProvider client={client}>
      <JobsPage />
    </QueryClientProvider>
  );
}

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  client = new QueryClient();
  state.vacancies = [vagaAberta()];
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

function chavesRepetidas(): string[] {
  return consoleError.mock.calls
    .map((args) => args.map(String).join(" "))
    .filter((msg) => /same key/i.test(msg));
}

describe("Vagas Empresa — modal 'Detalhes da vaga': seções por vaga não se repetem", () => {
  it("a lista muda com o modal aberto (freelancer escolhido, vaga fecha e reabre): cada seção aparece uma vez só", () => {
    const { rerender } = render(ui());
    fireEvent.click(screen.getAllByTitle("Ver")[0]);
    expect(screen.getByText("Detalhes da Vaga")).toBeInTheDocument();
    expect(screen.getAllByTestId("secao-divulgacao")).toHaveLength(1);
    expect(screen.getAllByTestId("secao-convite")).toHaveLength(1);
    expect(screen.getAllByTestId("secao-reservas")).toHaveLength(1);
    expect(screen.getAllByTestId("secao-selecao")).toHaveLength(1);

    // A lista recarrega com a vaga fechada (a empresa escolheu a Ana).
    state.vacancies = [vagaFechada()];
    rerender(ui());
    expect(screen.getAllByTestId("secao-divulgacao")).toHaveLength(1);
    expect(screen.queryAllByTestId("secao-convite")).toHaveLength(0);
    expect(screen.getAllByTestId("secao-reservas")).toHaveLength(1);
    expect(screen.getAllByTestId("secao-selecao")).toHaveLength(1);

    // A Ana foi desvinculada: a vaga reabre.
    state.vacancies = [vagaAberta()];
    rerender(ui());
    expect(screen.getAllByTestId("secao-divulgacao")).toHaveLength(1);
    expect(screen.getAllByTestId("secao-convite")).toHaveLength(1);
    expect(screen.getAllByTestId("secao-reservas")).toHaveLength(1);
    expect(screen.getAllByTestId("secao-selecao")).toHaveLength(1);

    expect(chavesRepetidas()).toEqual([]);
  });
});

// Fluxo v2, fatia C2: o "Abrir a vaga" da fila do suporte chega como /jobs?vaga=<id>.
describe("Vagas Empresa — link /jobs?vaga=<id> (Abrir a vaga da fila do suporte)", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("abre o modal da vaga sozinho e limpa o endereço", () => {
    window.history.replaceState(null, "", "/jobs?vaga=vac-1");
    render(ui());
    expect(screen.getByText("Detalhes da Vaga")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("vaga fora da lista carregada: abre a busca por ID já preenchida", () => {
    window.history.replaceState(null, "", "/jobs?vaga=vac-outra");
    render(ui());
    expect(screen.getByText("Buscar vaga por ID")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Cole aqui o ID da vaga")).toHaveValue("vac-outra");
  });
});

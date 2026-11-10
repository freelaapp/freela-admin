import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
// O modo "Escolher titular e suplentes" lê os suplentes da vaga aberta no modal; aqui não vai à rede.
vi.mock("@/modules/admin/application/use-vacancy-reserves", () => ({
  useVacancyReserves: () => ({ data: undefined }),
}));
vi.mock("@/modules/admin/application/use-admin-catalog", () => ({ useCatalogRoles: () => ({ data: [] }) }));
vi.mock("@/modules/admin/application/use-vacancy-feedbacks", () => ({
  useVacancyFeedbacks: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/modules/admin/application/use-admin-cancel-vacancy", () => ({
  useAdminCancelVacancy: mutation,
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
const listaProps = vi.hoisted(() => ({ last: undefined as Record<string, unknown> | undefined }));
vi.mock("@/components/admin/vacancy/vacancy-candidacy-list", () => ({
  VacancyCandidacyList: (props: Record<string, unknown>) => {
    listaProps.last = props;
    return <section data-testid="lista-candidatos" />;
  },
}));
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

// Vagas em lote, fatia 1 (A1): por padrão a API é a de antes (404); cada teste pode trocar.
const lotsApi = vi.hoisted(() => ({ byVacancy: vi.fn() }));
vi.mock("@/modules/admin/infrastructure/lots-api", () => ({ getAdminLotByVacancy: lotsApi.byVacancy }));
function rejectWith404() {
  const err = Object.assign(new Error("Not Found"), { isAxiosError: true, response: { status: 404, data: {} } });
  lotsApi.byVacancy.mockRejectedValue(err);
}

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


beforeEach(() => {
  client = new QueryClient();
  state.vacancies = [vagaAberta()];
  lotsApi.byVacancy.mockReset();
  rejectWith404();
});

function abrirModal() {
  render(ui());
  fireEvent.click(screen.getAllByTitle("Ver")[0]);
  return screen.getByTestId("modal-vaga-corpo");
}

describe("Vagas Empresa — modal 'Detalhes da vaga': candidatos primeiro", () => {
  it("a lista de candidatos vem antes do bloco 'Detalhes da vaga'", () => {
    abrirModal();
    const lista = screen.getByTestId("lista-candidatos");
    const detalhes = screen.getByTestId("detalhes-vaga");
    expect(lista.compareDocumentPosition(detalhes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("o bloco 'Detalhes da vaga' começa fechado", () => {
    abrirModal();
    const detalhes = screen.getByTestId("detalhes-vaga") as HTMLDetailsElement;
    expect(detalhes.open).toBe(false);
    expect(screen.getByText("Detalhes da vaga")).toBeInTheDocument();
  });

  it("a linha-resumo mostra empresa, cargo e status, fora do bloco recolhido", () => {
    abrirModal();
    const resumo = screen.getByTestId("resumo-vaga");
    expect(resumo).toHaveTextContent("Bar do Zé");
    expect(resumo).toHaveTextContent("Garçom");
    expect(resumo.textContent).toMatch(/aberta|aberto/i);
    expect(screen.getByTestId("detalhes-vaga")).not.toContainElement(resumo);
  });

  it("a lista não tem rolagem própria dentro do modal (uma rolagem só, a do corpo)", () => {
    const corpo = abrirModal();
    expect(listaProps.last?.scrollable).toBe(false);
    expect(corpo.className).toContain("overflow-y-auto");
    expect(corpo.className).not.toMatch(/max-h-/);
  });

  it("rodada de seleção e suplentes vêm depois dos candidatos", () => {
    abrirModal();
    const lista = screen.getByTestId("lista-candidatos");
    for (const id of ["secao-selecao", "secao-reservas"]) {
      expect(lista.compareDocumentPosition(screen.getByTestId(id)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe("Vagas Empresa — modal 'Detalhes da vaga': freelancer alocado no resumo", () => {
  it("com freelancer alocado, o nome aparece na linha-resumo", () => {
    state.vacancies = [vagaFechada()];
    abrirModal();
    expect(screen.getByTestId("resumo-vaga")).toHaveTextContent("Ana Souza");
  });
});

describe("Vagas Empresa — modal 'Detalhes da vaga': sinal de chegada (Cheguei)", () => {
  it("com arrivalSignal, o texto da API aparece discreto no resumo", () => {
    state.vacancies = [{ ...vagaFechada(), arrivalSignal: { text: "Chegou às 17h32, a 80 m (app)" } }];
    abrirModal();
    expect(screen.getByTestId("resumo-vaga")).toHaveTextContent("Chegou às 17h32, a 80 m (app)");
  });

  it("sem o campo (API antiga) ou com null: nada aparece", () => {
    state.vacancies = [vagaFechada()];
    const { unmount } = render(ui());
    fireEvent.click(screen.getAllByTitle("Ver")[0]);
    expect(screen.queryByTestId("arrival-signal")).not.toBeInTheDocument();
    unmount();

    state.vacancies = [{ ...vagaFechada(), arrivalSignal: null }];
    abrirModal();
    expect(screen.queryByTestId("arrival-signal")).not.toBeInTheDocument();
  });
});

describe("Vagas Empresa: modal da vaga, lote (A1)", () => {
  it("API sem lote (404): o modal fica igual a hoje, sem linha de lote e sem erro", async () => {
    abrirModal();
    await waitFor(() => expect(lotsApi.byVacancy).toHaveBeenCalledWith("vac-1"));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("vacancy-lot-line")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("lista-candidatos")).toBeInTheDocument();
    expect(screen.getByTestId("secao-selecao")).toBeInTheDocument();
  });

  it("vaga em lote: a linha aparece no modal, antes da rodada de seleção", async () => {
    lotsApi.byVacancy.mockResolvedValue({
      lot: {
        id: "lot-1",
        serviceDate: "2026-11-14",
        totals: { vacancies: 12, chosen: 5, paid: 3, free: 7, chosenUnpaid: 2, candidatesToChoose: 4, functions: 1, cancelled: 0 },
      },
      besideLot: null,
    });
    abrirModal();
    const linha = await screen.findByTestId("vacancy-lot-line");
    expect(linha).toHaveTextContent("Lote: 12 vagas · 5 escolhidas · 3 pagas");
    expect(linha.compareDocumentPosition(screen.getByTestId("secao-selecao")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

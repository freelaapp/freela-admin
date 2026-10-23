import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { VacancyItem } from "@/modules/admin/infrastructure/admin-api";
import { formatCents } from "@/lib/money";

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

describe("Vagas Empresa — detalhes: 'pagou' × 'vai pagar' e vaga extra (AD-0b)", () => {
  // Coco Bambu Osasco (22/10): vaga Aberta, sem pagamento, R$ 100,00 ao freelancer,
  // aparecia como "Contratante pagou à plataforma R$ 141,06", com a vaga extra de
  // R$ 10,00 escondida na "Taxa de serviço" (36,21 = 26,21 + 10,00).
  const cocoBambu = (over: Partial<VacancyItem> = {}) =>
    vaga({
      status: "OPEN",
      providerId: null,
      providerName: null,
      providerPixKeys: [],
      payment: 14106,
      fixedFeeInCents: 185,
      repasseLiquidoInCents: 10000,
      providerTakeInCents: 10000,
      taxaServicoInCents: 3621,
      platformMarginInCents: 3621,
      seguroInCents: 300,
      inssInCents: 1100,
      subscriptionDiscountInCents: 0,
      extraJobFeeInCents: 1000,
      paymentStatus: "NONE",
      paymentMethod: null,
      ...over,
    });

  function abrirDetalhes() {
    render(ui());
    fireEvent.click(screen.getAllByTitle("Ver")[0]);
    return screen.getByRole("dialog");
  }

  function linha(dialog: HTMLElement, rotulo: string) {
    return within(dialog).getByText(rotulo).closest("div") as HTMLElement;
  }

  it('vaga aberta sem pagamento diz "vai pagar"', () => {
    state.vacancies = [cocoBambu()];
    const dialog = abrirDetalhes();

    expect(within(dialog).getByText("Contratante vai pagar (quando escolher o freelancer)")).toBeInTheDocument();
    expect(within(dialog).queryByText("Contratante pagou à plataforma")).not.toBeInTheDocument();
  });

  it('Pix gerado e não pago (PENDING) também diz "vai pagar"', () => {
    state.vacancies = [cocoBambu({ paymentStatus: "PENDING", paymentMethod: "PIX" })];
    const dialog = abrirDetalhes();

    expect(within(dialog).getByText("Contratante vai pagar (quando escolher o freelancer)")).toBeInTheDocument();
    expect(within(dialog).queryByText("Contratante pagou à plataforma")).not.toBeInTheDocument();
  });

  it('só diz "pagou" com o pagamento concluído', () => {
    state.vacancies = [cocoBambu({ status: "CLOSED", paymentStatus: "PAID", paymentMethod: "PIX" })];
    const dialog = abrirDetalhes();

    expect(within(dialog).getByText("Contratante pagou à plataforma")).toBeInTheDocument();
  });

  it('faturado: "Entra na fatura da empresa"', () => {
    state.vacancies = [cocoBambu({ status: "CLOSED", paymentStatus: "PAID", paymentMethod: "INVOICE" })];
    const dialog = abrirDetalhes();

    expect(within(dialog).getByText("Entra na fatura da empresa")).toBeInTheDocument();
    expect(within(dialog).queryByText("Contratante pagou à plataforma")).not.toBeInTheDocument();
  });

  it("API sem a situação do pagamento: não afirma que pagou nem que vai pagar", () => {
    state.vacancies = [cocoBambu({ paymentStatus: undefined })];
    const dialog = abrirDetalhes();

    expect(within(dialog).getByText("Contratante paga à plataforma")).toBeInTheDocument();
    expect(within(dialog).queryByText("Contratante pagou à plataforma")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText("Contratante vai pagar (quando escolher o freelancer)"),
    ).not.toBeInTheDocument();
  });

  it("mostra Vaga extra 10,00 em linha própria", () => {
    state.vacancies = [cocoBambu()];
    const dialog = abrirDetalhes();

    expect(linha(dialog, "Vaga extra do mês")).toHaveTextContent(formatCents(1000));
    // A "Taxa de serviço" passa a ser só a intermediação (36,21 − 10,00).
    expect(linha(dialog, "Taxa de serviço")).toHaveTextContent(formatCents(2621));
    expect(linha(dialog, "Taxa de serviço")).not.toHaveTextContent(formatCents(3621));
    // O total não muda, e o resíduo diz que leva a vaga extra.
    expect(within(dialog).getAllByText(formatCents(14106)).length).toBeGreaterThan(0);
    expect(linha(dialog, "Nosso resíduo (taxa + vaga extra + Pix)")).toHaveTextContent(
      formatCents(2621 + 1000 + 185),
    );
  });

  it("sem vaga extra: nenhuma linha de vaga extra", () => {
    state.vacancies = [cocoBambu({ extraJobFeeInCents: 0, payment: 13106, taxaServicoInCents: 2621 })];
    const dialog = abrirDetalhes();

    expect(within(dialog).queryByText("Vaga extra do mês")).not.toBeInTheDocument();
    expect(linha(dialog, "Taxa de serviço")).toHaveTextContent(formatCents(2621));
    expect(within(dialog).getByText("Nosso resíduo (taxa + Pix)")).toBeInTheDocument();
  });
});

describe("Vagas Empresa — detalhes: fórmula v2 (AD-V2)", () => {
  // Vaga NET: o freelancer recebe 100,00, Grátis a 10% → 100,00 + 10,00 + 1,85 + 3,00 = 114,85.
  const netVaga = (over: Partial<VacancyItem> = {}) =>
    vaga({
      status: "CLOSED",
      payment: 11485,
      fixedFeeInCents: 185,
      repasseLiquidoInCents: 10000,
      providerTakeInCents: 10000,
      taxaServicoInCents: 1000,
      platformMarginInCents: 1000,
      seguroInCents: 300,
      inssInCents: 1100,
      subscriptionDiscountInCents: 0,
      extraJobFeeInCents: 0,
      paymentStatus: "PAID",
      paymentMethod: "PIX",
      feeBasis: "NET",
      lockedPlanFeePercent: 10,
      ...over,
    });

  function abrirDetalhes() {
    render(ui());
    fireEvent.click(screen.getAllByTitle("Ver")[0]);
    return screen.getByRole("dialog");
  }

  it('vaga NET: "Taxa de serviço (10% do valor do freelancer)" 10,00, sem "(plano: −…)"', () => {
    state.vacancies = [netVaga({ subscriptionDiscountInCents: 500 })];
    const dialog = abrirDetalhes();

    const fee = within(dialog).getByText("Taxa de serviço (10% do valor do freelancer)").closest("div") as HTMLElement;
    expect(fee).toHaveTextContent(formatCents(1000));
    expect(within(dialog).queryByText(/plano: −/)).not.toBeInTheDocument();
    expect(within(dialog).getAllByText(formatCents(11485)).length).toBeGreaterThan(0);
  });

  it('vaga GROSS com plano: o rótulo de hoje e o "(plano: −…)"', () => {
    state.vacancies = [netVaga({ feeBasis: "GROSS", lockedPlanFeePercent: 10, subscriptionDiscountInCents: 500 })];
    const dialog = abrirDetalhes();

    expect(within(dialog).queryByText("Taxa de serviço (10% do valor do freelancer)")).not.toBeInTheDocument();
    expect(within(dialog).getByText(/plano: −/)).toBeInTheDocument();
  });
});

describe("Vagas Empresa — 'Cancelar Vaga' no celular", () => {
  it("o diálogo rola por dentro (motivo, estorno e botões não somem)", () => {
    render(ui());
    fireEvent.click(screen.getAllByTitle("Ver")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar Vaga" }));

    const titulo = screen.getByRole("heading", { name: "Cancelar Vaga" });
    expect(titulo.closest(".overflow-y-auto")).toHaveClass("max-h-[88vh]");
  });
});

describe("Vagas Empresa — ordenação inicial", () => {
  const vagas = () => [
    vaga({ id: "v-out", contractorCompanyName: "Bar Outubro", date: "2026-10-20T00:00:00.000Z", candidacyCount: 1 }),
    vaga({ id: "v-nov", contractorCompanyName: "Bar Novembro", date: "2026-11-05T00:00:00.000Z", candidacyCount: 0 }),
    vaga({ id: "v-set", contractorCompanyName: "Bar Setembro", date: "2026-09-02T00:00:00.000Z", candidacyCount: 9 }),
  ];

  function empresasNaOrdem() {
    const tabela = screen.getByTestId("data-table-desktop");
    return within(tabela)
      .getAllByRole("row")
      .slice(1)
      .map((tr) => within(tr).getAllByRole("cell")[0].textContent);
  }

  it.each([
    ["admin", false],
    ["super-admin (com a coluna Consultor)", true],
  ])("%s: abre pela 'Data do serviço', mais recente primeiro", (_quem, superAdmin) => {
    state.isSuperAdmin = superAdmin;
    state.vacancies = vagas();
    render(ui());

    expect(screen.getByRole("columnheader", { name: /Data do serviço/ })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: /Candidatos/ })).not.toHaveAttribute("aria-sort");
    expect(empresasNaOrdem()).toEqual(["Bar Novembro", "Bar Outubro", "Bar Setembro"]);
  });
});

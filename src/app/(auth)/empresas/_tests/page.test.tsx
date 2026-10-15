import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAdminUpdateContractor } from "@/modules/admin/application/use-admin-contractors";
import type { ContractorItem } from "@/modules/admin/infrastructure/admin-api";
import EmpresasPage from "../page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
// Peças pesadas (PDF, criar vaga, excluir) não entram neste teste.
vi.mock("@/modules/admin/infrastructure/contractor-report-pdf", () => ({
  generateContractorReportPdf: vi.fn(),
}));
vi.mock("@/components/admin/vacancy/abrir-vaga-dialog", () => ({ AbrirVagaDialog: () => null }));
vi.mock("@/components/admin/excluir-usuario-dialog", () => ({ ExcluirUsuarioPanel: () => null }));
// Sonda: prova com que empresa o modal "Documentos e cobrança" abriu.
vi.mock("../_components/preferences-dialog", () => ({
  PreferencesDialog: ({
    contractorUserId,
    companyName,
    companyDocument,
    onEditCompany,
  }: {
    contractorUserId: string;
    companyName: string;
    companyDocument?: string | null;
    onEditCompany?: () => void;
  }) => (
    <div data-testid="preferences-probe">
      {`${contractorUserId} · ${companyName} · ${companyDocument ?? "-"}`}
      <button type="button" onClick={onEditCompany}>
        Corrigir cadastro
      </button>
    </div>
  ),
}));

const barDoZe: ContractorItem = {
  id: "contractor-1",
  userId: "owner-user-1",
  companyName: "Bar do Zé",
  contactName: "Zé",
  contactEmail: "contato@bardoze.com.br",
  registrationEmail: "ze@bardoze.com.br",
  contactPhone: "+5511999990000",
  city: "Campinas",
  uf: "SP",
  segment: "Bar",
  cnpj: "12.345.678/0001-90",
  cpf: null,
  isActive: true,
  createdAt: "2026-09-01T12:00:00.000Z",
  jobs: 3,
  ticketMedio: null,
  avaliacao: null,
};

const semUsuario: ContractorItem = { ...barDoZe, id: "contractor-2", userId: "", companyName: "Sem Dono" };

/** Faturada semanal desde 11/10/2026 15:20 (Brasília), com fatura vencida bloqueando. */
const redeX: ContractorItem = {
  ...barDoZe,
  id: "contractor-3",
  userId: "owner-user-3",
  companyName: "Rede X",
  billingMode: "INVOICED_7",
  billingModeLabel: "Faturado semanal",
  billingModeSince: "2026-10-11T18:20:00.000Z",
  billingStanding: { blocked: true, overdueDays: 5, blockEnabled: true },
};

/** Faturada quinzenal, em dia. */
const redeY: ContractorItem = {
  ...barDoZe,
  id: "contractor-4",
  userId: "owner-user-4",
  companyName: "Rede Y",
  billingMode: "INVOICED_15",
  billingModeLabel: "Faturado quinzenal",
  billingModeSince: "2026-10-01T12:00:00.000Z",
  billingStanding: { blocked: false, overdueDays: 0, blockEnabled: true },
};

vi.mock("@/modules/admin/application/use-admin-contractors", () => ({
  useAdminContractors: () => ({
    data: [barDoZe, semUsuario, redeX, redeY],
    isLoading: false,
    isError: false,
  }),
  useAdminUpdateContractor: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

const settings = vi.hoisted(() => ({
  current: { signedContractEnabled: true, rpaEnabled: true, inssRemindersEnabled: true },
  calls: [] as string[],
}));
vi.mock("@/modules/admin/application/use-admin-contractor-settings", () => ({
  useAdminContractorSettings: (contractorUserId: string) => {
    settings.calls.push(contractorUserId);
    return { data: settings.current, isLoading: false, isError: false };
  },
}));

/** Linha da tabela (desktop) da empresa; a lista em cartões repete os botões. */
const rowOf = (company: string) => screen.getAllByText(company)[0].closest("tr") as HTMLElement;
const documentsButton = (company: string) =>
  within(rowOf(company)).getByRole("button", { name: "Documentos e cobrança" });

describe("Empresas — Documentos e cobrança", () => {
  it("botão da linha abre o modal com o userId do dono", () => {
    render(<EmpresasPage />);

    fireEvent.click(documentsButton("Bar do Zé"));

    expect(screen.getByTestId("preferences-probe")).toHaveTextContent(
      "owner-user-1 · Bar do Zé · 12.345.678/0001-90",
    );
  });

  it("'Corrigir cadastro' troca para o modal Editar Empresa, com o endereço para completar", () => {
    render(<EmpresasPage />);
    fireEvent.click(documentsButton("Bar do Zé"));

    fireEvent.click(screen.getByRole("button", { name: "Corrigir cadastro" }));

    expect(screen.getByText("Editar Empresa")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da empresa")).toHaveValue("Bar do Zé");
    expect(screen.getByLabelText("Número")).toHaveValue("");
    expect(screen.queryByTestId("preferences-probe")).not.toBeInTheDocument();
  });

  it("sem usuário dono, o botão fica desabilitado", () => {
    render(<EmpresasPage />);

    expect(documentsButton("Sem Dono")).toBeDisabled();
  });
});

describe("Empresas — Detalhes da Empresa", () => {
  it("linha 'Documentos: tudo ligado' ou 'Documentos: contrato desligado' pelo GET de settings (UX 5.2)", () => {
    settings.current = { signedContractEnabled: false, rpaEnabled: true, inssRemindersEnabled: true };
    const { unmount } = render(<EmpresasPage />);
    fireEvent.click(within(rowOf("Bar do Zé")).getByRole("button", { name: "Ver detalhes" }));

    expect(screen.getByText("Documentos: contrato desligado")).toBeInTheDocument();
    expect(settings.calls).toContain("owner-user-1");
    unmount();

    settings.current = { signedContractEnabled: true, rpaEnabled: true, inssRemindersEnabled: true };
    render(<EmpresasPage />);
    fireEvent.click(within(rowOf("Bar do Zé")).getByRole("button", { name: "Ver detalhes" }));

    expect(screen.getByText("Documentos: tudo ligado")).toBeInTheDocument();
  });
});

describe("Empresas — modo de cobrança", () => {
  it("selo 'Faturado semanal · bloqueada' de billingMode + billingStanding", () => {
    render(<EmpresasPage />);

    expect(within(rowOf("Rede X")).getByText("Faturado semanal · bloqueada")).toBeInTheDocument();
    expect(within(rowOf("Rede Y")).getByText("Faturado quinzenal")).toBeInTheDocument();
    expect(within(rowOf("Rede Y")).queryByText(/bloqueada/)).not.toBeInTheDocument();
  });

  it("pré-pago: sem selo", () => {
    render(<EmpresasPage />);

    expect(within(rowOf("Bar do Zé")).queryByText(/Faturado/)).not.toBeInTheDocument();
    expect(within(rowOf("Bar do Zé")).queryByText(/Pré-pago/)).not.toBeInTheDocument();
  });

  it("Detalhes: 'Cobrança: Faturado semanal desde 11/10/2026'; pré-pago: 'Cobrança: Pré-pago (Pix a cada contratação)'", () => {
    const { unmount } = render(<EmpresasPage />);
    fireEvent.click(within(rowOf("Rede X")).getByRole("button", { name: "Ver detalhes" }));
    expect(screen.getByText("Cobrança: Faturado semanal desde 11/10/2026")).toBeInTheDocument();
    unmount();

    render(<EmpresasPage />);
    fireEvent.click(within(rowOf("Bar do Zé")).getByRole("button", { name: "Ver detalhes" }));
    expect(screen.getByText("Cobrança: Pré-pago (Pix a cada contratação)")).toBeInTheDocument();
  });
});

describe("Empresas — Editar Empresa, CEP", () => {
  it("CEP com máscara; incompleto não salva e mostra o erro no campo", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useAdminUpdateContractor).mockReturnValue({ mutateAsync, isPending: false } as never);
    render(<EmpresasPage />);
    fireEvent.click(within(rowOf("Bar do Zé")).getByRole("button", { name: "Editar" }));

    const cep = screen.getByLabelText("CEP");
    fireEvent.change(cep, { target: { value: "36000" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(cep).toHaveAttribute("aria-invalid", "true");
    expect(cep).toHaveAccessibleDescription("O CEP tem 8 números, por exemplo 36000-000.");

    fireEvent.change(cep, { target: { value: "36000000" } });
    expect(cep).toHaveValue("36000-000");
    expect(cep).not.toHaveAttribute("aria-invalid");
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await vi.waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        id: "contractor-1",
        payload: expect.objectContaining({ cep: "36000-000" }),
      }),
    );
  });
});

describe("Empresas — modal no celular", () => {
  it("'Detalhes da Empresa' rola por dentro (o X e os botões não somem)", () => {
    render(<EmpresasPage />);
    fireEvent.click(within(rowOf("Bar do Zé")).getByTitle("Ver detalhes"));

    const titulo = screen.getByText("Detalhes da Empresa");
    expect(titulo.closest(".overflow-y-auto")).toHaveClass("max-h-[88vh]");
  });
});

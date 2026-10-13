import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

vi.mock("@/modules/admin/application/use-admin-contractors", () => ({
  useAdminContractors: () => ({ data: [barDoZe, semUsuario], isLoading: false, isError: false }),
  useAdminUpdateContractor: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConsultorProfilePage from "../page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "c1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/modules/auth/application/use-auth", () => ({
  useAuth: () => ({ isHydrated: true, isSuperAdmin: true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const { mutation } = vi.hoisted(() => ({
  mutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/modules/admin/application/use-admin-consultants", () => ({
  useAdminConsultant: () => ({
    data: {
      id: "c1",
      name: "Rebeca Rocha",
      code: "REBECAR4BK",
      city: null,
      uf: null,
      phone: null,
      email: "r@x.com",
      commissionRate: 12,
      notes: null,
      isActive: true,
      referralsCount: 3,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useResetConsultantAccess: mutation,
  useRestoreAdminConsultant: mutation,
  useUpdateAdminConsultant: mutation,
  useCreateAdminConsultant: mutation,
  useDeleteAdminConsultant: mutation,
}));
vi.mock("@/modules/admin/application/use-admin-whatsapp-groups", () => ({ useCreateWhatsappGroup: mutation }));
vi.mock("../_components/commission-rule-tab", () => ({ CommissionRuleTab: () => <p>aba-comissao</p> }));
vi.mock("../_components/commission-dashboard-tab", () => ({ CommissionDashboardTab: () => <p>aba-painel</p> }));
vi.mock("../_components/commission-statement-tab", () => ({ CommissionStatementTab: () => <p>aba-extrato</p> }));

describe("Página do consultor — abas", () => {
  it("abre no Perfil e troca para Comissão", () => {
    render(<ConsultorProfilePage />);
    expect(screen.getByText("REBECAR4BK")).toBeInTheDocument();
    expect(screen.queryByText("aba-comissao")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Comissão" }));
    expect(screen.getByText("aba-comissao")).toBeInTheDocument();
  });

  it("o % antigo do cadastro não aparece mais no perfil", () => {
    render(<ConsultorProfilePage />);
    expect(screen.queryByText("12%")).not.toBeInTheDocument();
  });

  it("no celular as abas começam à esquerda (a primeira nunca fica cortada)", () => {
    render(<ConsultorProfilePage />);
    expect(screen.getByRole("button", { name: "Perfil" }).parentElement).toHaveClass("justify-start");
  });
});

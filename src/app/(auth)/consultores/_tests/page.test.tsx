import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConsultantItem } from "@/modules/admin/infrastructure/consultants-api";
import ConsultoresPage from "../page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/modules/auth/application/use-auth", () => ({
  useAuth: () => ({ isHydrated: true, isSuperAdmin: true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const rebeca: ConsultantItem = {
  id: "c1",
  name: "Rebeca Rocha",
  code: "REBECAR4BK",
  city: null,
  uf: null,
  phone: null,
  email: "r@x.com",
  commissionRate: null,
  notes: null,
  isActive: true,
  referralsCount: 3,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  commissionRuleSummary: "10% da taxa da Freela em cada serviço concluído · Empresa · sem prazo",
  openBalanceInCents: 315,
};

vi.mock("@/modules/admin/application/use-admin-consultants", () => ({
  useAdminConsultants: () => ({ data: [rebeca], isLoading: false, isError: false }),
  useUpdateAdminConsultant: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRestoreAdminConsultant: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateAdminConsultant: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteAdminConsultant: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/modules/admin/application/use-admin-consultant-commissions", () => ({
  useCommissionsSummary: () => ({ data: { openInCents: 315, paidThisMonthInCents: 1000 } }),
}));

describe("Consultores — comissão na lista", () => {
  it("mostra a regra em texto, o a pagar de cada um e a faixa com os totais", () => {
    render(<ConsultoresPage />);
    expect(screen.getAllByText(/10% da taxa da Freela/).length).toBeGreaterThan(0);
    expect(screen.getByText("Comissão a pagar (todos)")).toBeInTheDocument();
    expect(screen.getByText("R$ 10,00")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 3,15").length).toBeGreaterThanOrEqual(2);
  });
});

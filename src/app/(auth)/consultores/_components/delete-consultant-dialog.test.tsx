import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConsultantItem } from "@/modules/admin/infrastructure/consultants-api";
import { DeleteConsultantDialog } from "./delete-consultant-dialog";

const hooks = vi.hoisted(() => ({
  statementFor: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock("@/modules/admin/application/use-admin-consultants", () => ({
  useDeleteAdminConsultant: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }),
}));
vi.mock("@/modules/admin/application/use-admin-consultant-commissions", () => ({
  useCommissionStatement: (id: string) => hooks.statementFor(id),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const consultant = (over: Partial<ConsultantItem> = {}): ConsultantItem => ({
  id: "c1",
  name: "André",
  code: "ANDRE2K",
  city: null,
  uf: null,
  phone: null,
  email: null,
  commissionRate: null,
  notes: null,
  isActive: true,
  referralsCount: 0,
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  ...over,
});

describe("DeleteConsultantDialog — saldo de comissão", () => {
  beforeEach(() => {
    hooks.statementFor.mockReset().mockReturnValue({ data: undefined });
  });

  it("da lista (com openBalanceInCents): avisa o saldo a pagar e não busca o extrato", () => {
    render(
      <DeleteConsultantDialog consultant={consultant({ openBalanceInCents: 31500 })} onOpenChange={vi.fn()} />,
    );

    expect(screen.getByText("Excluir consultor (exclusão lógica)")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 315,00 de comissão a pagar/)).toBeInTheDocument();
    expect(hooks.statementFor).toHaveBeenCalledWith("");
  });

  it("do detalhe (sem openBalanceInCents): usa o 'A pagar' do extrato da comissão", () => {
    hooks.statementFor.mockImplementation((id: string) =>
      id === "c1" ? { data: { balances: { openInCents: 4200, paidInCents: 0 } } } : { data: undefined },
    );
    render(<DeleteConsultantDialog consultant={consultant()} onOpenChange={vi.fn()} />);

    expect(hooks.statementFor).toHaveBeenCalledWith("c1");
    expect(screen.getByText("Excluir consultor (exclusão lógica)")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 42,00 de comissão a pagar/)).toBeInTheDocument();
  });
});

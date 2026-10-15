import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConsultantItem } from "@/modules/admin/infrastructure/consultants-api";
import { DeleteConsultantDialog } from "./delete-consultant-dialog";

type BalancesResult = { data: { openInCents: number; paidInCents: number } | null | undefined; isPending: boolean };

const hooks = vi.hoisted(() => ({
  balancesFor: vi.fn<(id: string | null) => BalancesResult>(),
  mutateAsync: vi.fn(),
}));

vi.mock("@/modules/admin/application/use-admin-consultants", () => ({
  useDeleteAdminConsultant: () => ({ mutateAsync: hooks.mutateAsync, isPending: false }),
}));
vi.mock("@/modules/admin/application/use-admin-consultant-commissions", () => ({
  useCommissionBalances: (id: string | null) => hooks.balancesFor(id),
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

const confirmButton = () => screen.getAllByRole("button").find((b) => /Excluir/.test(b.textContent ?? ""))!;

describe("DeleteConsultantDialog — saldo de comissão", () => {
  beforeEach(() => {
    hooks.balancesFor.mockReset().mockReturnValue({ data: undefined, isPending: true });
  });

  it("da lista (com openBalanceInCents): avisa o saldo a pagar e não busca o extrato", () => {
    render(
      <DeleteConsultantDialog consultant={consultant({ openBalanceInCents: 31500 })} onOpenChange={vi.fn()} />,
    );

    expect(hooks.balancesFor).toHaveBeenCalledWith(null);
    expect(screen.getByText("Excluir consultor (exclusão lógica)")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 315,00 de comissão a pagar/)).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
  });

  it("do detalhe, enquanto o extrato carrega: 'Conferindo saldo…' e confirmação travada", () => {
    render(<DeleteConsultantDialog consultant={consultant()} onOpenChange={vi.fn()} />);

    expect(hooks.balancesFor).toHaveBeenCalledWith("c1");
    expect(screen.getByRole("status")).toHaveTextContent("Conferindo saldo de comissão…");
    expect(screen.queryByText(/definitivamente/)).not.toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
  });

  it("do detalhe, com o extrato: usa o 'A pagar' dele", () => {
    hooks.balancesFor.mockReturnValue({ data: { openInCents: 4200, paidInCents: 0 }, isPending: false });
    render(<DeleteConsultantDialog consultant={consultant()} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Excluir consultor (exclusão lógica)")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 42,00 de comissão a pagar/)).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
  });

  it("do detalhe, extrato falhou: sem o texto de exclusão definitiva, com o aviso de saldo não conferido", () => {
    hooks.balancesFor.mockReturnValue({ data: undefined, isPending: false });
    render(<DeleteConsultantDialog consultant={consultant()} onOpenChange={vi.fn()} />);

    expect(screen.queryByText(/definitivamente/)).not.toBeInTheDocument();
    expect(screen.getByText(/Não foi possível conferir o saldo de comissão dele agora/)).toBeInTheDocument();
    expect(confirmButton()).toHaveTextContent("Excluir");
  });
});

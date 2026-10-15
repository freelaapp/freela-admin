import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const wallet = {
  userId: "u1",
  balanceInCents: 10000,
  status: "ACTIVE",
  name: "Bar do Zé",
  email: "ze@bar.com",
  createdAt: "2026-09-01T12:00:00.000Z",
};

vi.mock("@/modules/auth/application/use-auth", () => ({ useAuth: () => ({ isSuperAdmin: true }) }));
vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("@/modules/admin/application/use-admin-wallets", () => ({
  useAdminWallets: () => ({
    data: {
      summary: { totalHeldInCents: 10000, walletsCount: 1, activeCount: 1 },
      items: [wallet],
      total: 1,
      page: 1,
      limit: 30,
    },
    isLoading: false,
    isError: false,
    isFetching: false,
  }),
  useAdminWalletLedger: (userId: string | null) => ({
    data: userId ? { balanceInCents: 12345, status: "ACTIVE", entries: [] } : undefined,
    isLoading: false,
  }),
  useAdjustWallet: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CarteirasPage from "../page";

const plain = (text: string | null | undefined) => (text ?? "").replace(/ /g, " ");

describe("Carteiras — detalhe da carteira", () => {
  it("rola por dentro no celular e a conferência do ajuste parte do saldo do extrato", () => {
    render(<CarteirasPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "Ver carteira" })[0]);

    const titulo = screen.getByText("Saldo atual");
    expect(titulo.closest(".overflow-y-auto")).toHaveClass("max-h-[88vh]");

    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "10,00" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Chamado #9" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar ajuste" }));
    // Saldo do extrato (R$ 123,45), não o da linha da lista (R$ 100,00).
    expect(plain(screen.getByTestId("wallet-adjust-after").textContent)).toBe("R$ 133,45");
  });
});

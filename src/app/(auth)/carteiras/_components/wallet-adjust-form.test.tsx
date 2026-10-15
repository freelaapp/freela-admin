import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WalletAdjustForm } from "./wallet-adjust-form";

const hook = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
vi.mock("@/modules/admin/application/use-admin-wallets", () => ({
  useAdjustWallet: () => hook,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

/** O Intl separa "R$" do número com espaço sem quebra; compara sem ele. */
const plain = (text: string | null | undefined) => (text ?? "").replace(/ /g, " ");

function preencher(sentido: "credit" | "debit", valor: string, motivo = "Chamado #123") {
  fireEvent.change(screen.getByLabelText("Sentido do ajuste"), { target: { value: sentido } });
  fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: valor } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: motivo } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar ajuste" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  hook.isPending = false;
  hook.mutateAsync.mockResolvedValue({ balanceInCents: 15000 });
});

describe("Ajuste manual da carteira", () => {
  it("'50.00' é R$ 50,00 (não R$ 5.000,00) e só grava depois de confirmar", async () => {
    render(<WalletAdjustForm userId="u1" currentBalanceInCents={10000} />);
    preencher("credit", "50.00");

    // Revisar não grava nada: mostra o sentido, o valor e o saldo depois.
    expect(hook.mutateAsync).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    expect(plain(dialog.textContent)).toContain("Creditar R$ 50,00?");
    expect(plain(screen.getByTestId("wallet-adjust-after").textContent)).toBe("R$ 150,00");
    expect(plain(dialog.textContent)).toContain("Saldo atualR$ 100,00");
    expect(plain(dialog.textContent)).toContain("Motivo: Chamado #123");

    fireEvent.click(screen.getByRole("button", { name: /Confirmar: creditar/ }));
    await waitFor(() =>
      expect(hook.mutateAsync).toHaveBeenCalledWith({
        userId: "u1",
        payload: { deltaInCents: 5000, reason: "Chamado #123" },
      }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(plain(toast.success.mock.calls[0][0])).toBe("Ajuste aplicado. Novo saldo: R$ 150,00");
  });

  it("'1.234,56' é R$ 1.234,56; débito vai negativo para a API", async () => {
    render(<WalletAdjustForm userId="u1" currentBalanceInCents={200000} />);
    preencher("debit", "1.234,56");

    expect(plain(screen.getByRole("alertdialog").textContent)).toContain("Debitar R$ 1.234,56?");
    expect(plain(screen.getByTestId("wallet-adjust-after").textContent)).toBe("R$ 765,44");
    fireEvent.click(screen.getByRole("button", { name: /Confirmar: debitar/ }));
    await waitFor(() =>
      expect(hook.mutateAsync).toHaveBeenCalledWith({
        userId: "u1",
        payload: { deltaInCents: -123456, reason: "Chamado #123" },
      }),
    );
  });

  it("'Voltar' fecha a conferência sem gravar", () => {
    render(<WalletAdjustForm userId="u1" currentBalanceInCents={10000} />);
    preencher("credit", "50,00");
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(hook.mutateAsync).not.toHaveBeenCalled();
  });

  it("valor ambíguo ou inválido ('1.000', 'abc', '0') não abre a conferência", () => {
    render(<WalletAdjustForm userId="u1" currentBalanceInCents={10000} />);
    for (const valor of ["1.000", "abc", "0"]) {
      preencher("credit", valor);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    }
    expect(toast.error).toHaveBeenCalledTimes(3);
    expect(toast.error.mock.calls[0][0]).toMatch(/Valor inválido/);
  });

  it("sem motivo não abre a conferência", () => {
    render(<WalletAdjustForm userId="u1" currentBalanceInCents={10000} />);
    preencher("credit", "50,00", "   ");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Informe o motivo do ajuste.");
  });

  it("débito maior que o saldo: avisa e não deixa confirmar", () => {
    render(<WalletAdjustForm userId="u1" currentBalanceInCents={3000} />);
    preencher("debit", "50,00");

    expect(screen.getByRole("alert")).toHaveTextContent("O saldo não cobre este débito");
    expect(plain(screen.getByTestId("wallet-adjust-after").textContent)).toMatch(/-R\$ 20,00|R\$ -20,00/);
    expect(screen.getByRole("button", { name: /Confirmar: debitar/ })).toBeDisabled();
  });

  it("enquanto o extrato carrega: 'Revisar ajuste' bloqueado (sem saldo atual não há conferência)", () => {
    render(<WalletAdjustForm userId="u1" currentBalanceInCents={null} />);
    const botao = screen.getByRole("button", { name: /Carregando saldo atual/ });
    expect(botao).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "50,00" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Chamado #1" } });
    fireEvent.click(botao);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(hook.mutateAsync).not.toHaveBeenCalled();
  });

  it("extrato falhou: bloqueado e diz por quê", () => {
    render(<WalletAdjustForm userId="u1" currentBalanceInCents={null} balanceError />);
    expect(screen.getByRole("button", { name: "Saldo indisponível" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar o saldo atual");
  });

  it("erro da API: mostra a mensagem dela, não a do axios", async () => {
    hook.mutateAsync.mockRejectedValue(
      Object.assign(new Error("Request failed with status code 422"), {
        isAxiosError: true,
        response: {
          status: 422,
          data: { error: { code: "UNPROCESSABLE_ENTITY", message: "Saldo insuficiente para este ajuste de débito." } },
        },
      }),
    );
    render(<WalletAdjustForm userId="u1" currentBalanceInCents={10000} />);
    preencher("debit", "50,00");
    fireEvent.click(screen.getByRole("button", { name: /Confirmar: debitar/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Saldo insuficiente para este ajuste de débito."),
    );
    // A conferência continua aberta para corrigir ou voltar.
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

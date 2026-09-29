import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserDeletionPreview } from "@/modules/admin/infrastructure/admin-api";

const previewState: { data?: UserDeletionPreview; isLoading: boolean; isError: boolean } = {
  data: undefined,
  isLoading: false,
  isError: false,
};
const mutateAsync = vi.fn();

vi.mock("@/modules/admin/application/use-admin-user-deletion", () => ({
  useUserDeletionPreview: () => ({ ...previewState, error: null, refetch: vi.fn() }),
  useAdminDeleteUser: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ExcluirUsuarioDialog } from "./excluir-usuario-dialog";

const zero = {
  vacancies: 0,
  candidacies: 0,
  fixedJobs: 0,
  repasses: 0,
  walletEntries: 0,
  referralsMade: 0,
  referralRewards: 0,
  paidSubscriptionCharges: 0,
};

const REASON = "Conta duplicada, confirmada com o titular";

describe("ExcluirUsuarioDialog", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    previewState.isLoading = false;
    previewState.isError = false;
  });

  it("com histórico: avisa ANTES que vai anonimizar e só libera com motivo + EXCLUIR", async () => {
    previewState.data = {
      userId: "u1",
      mode: "SOFT",
      history: { ...zero, vacancies: 2 },
      historyTotal: 2,
      blockers: [],
    };
    mutateAsync.mockResolvedValue({ mode: "SOFT" });
    const onClose = vi.fn();

    render(
      <ExcluirUsuarioDialog userId="u1" displayName="Bar do Zé" accountType="contractor" onClose={onClose} />,
    );

    expect(
      screen.getByText("Esta conta tem histórico — será desativada e anonimizada, não apagada"),
    ).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: /Desativar e anonimizar/ });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Motivo da exclusão/), { target: { value: REASON } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/para/), { target: { value: "excluir" } });
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ userId: "u1", reason: REASON, accountType: "contractor" }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("bloqueado: mostra o motivo e não oferece o botão de excluir", () => {
    previewState.data = {
      userId: "u1",
      mode: "BLOCKED",
      history: zero,
      historyTotal: 0,
      blockers: ["Tem serviço em andamento — conclua ou cancele antes de excluir."],
    };

    render(<ExcluirUsuarioDialog userId="u1" displayName="Ana" onClose={vi.fn()} />);

    expect(
      screen.getByText("Tem serviço em andamento — conclua ou cancele antes de excluir."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Motivo da exclusão/)).not.toBeInTheDocument();
  });
});

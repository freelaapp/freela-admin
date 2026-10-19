import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/admin/infrastructure/held-repasses-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/admin/infrastructure/held-repasses-api")>()),
  listFailedWithdrawals: vi.fn(),
  retryWithdrawal: vi.fn(),
}));

import {
  listFailedWithdrawals,
  retryWithdrawal,
  type FailedWithdrawalItem,
} from "@/modules/admin/infrastructure/held-repasses-api";
import { FailedWithdrawalsPanel } from "./failed-withdrawals-panel";

const ITEMS: FailedWithdrawalItem[] = [
  {
    repasseId: "rep-1",
    vacancyId: "ab12cd34-0000-0000-0000-000000000000",
    amountInCents: 12500,
    freelancerName: "Jaqueline Ribeiro",
    failureReason: "OpenPix rejected withdraw: muitas chaves Pix que não existem",
    failedAt: "2026-10-17T22:05:00.000Z",
  },
  {
    repasseId: "rep-2",
    vacancyId: "ef56ab78-0000-0000-0000-000000000000",
    amountInCents: 8000,
    freelancerName: "Bianca Melo",
    failureReason: null,
    failedAt: null,
  },
];

function apiError(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("falhou", String(status), config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data: { error: { code, message: code } },
  });
}

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FailedWithdrawalsPanel />
    </QueryClientProvider>,
  );
}

const nbsp = (value: string | null | undefined) => (value ?? "").replace(/ /g, " ");

beforeEach(() => vi.clearAllMocks());

describe("FailedWithdrawalsPanel", () => {
  it("lista os saques parados com o total e o botão de cada um", async () => {
    vi.mocked(listFailedWithdrawals).mockResolvedValue(ITEMS);
    renderPanel();

    expect(nbsp((await screen.findByRole("heading", { name: /2 saques parados/ })).textContent)).toBe(
      "2 saques parados · R$ 205,00",
    );
    expect(screen.getByRole("button", { name: "Reenviar saque de R$ 125,00 para Jaqueline Ribeiro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar saque de R$ 80,00 para Bianca Melo" })).toBeInTheDocument();
  });

  it("sem saque parado, o painel não aparece", async () => {
    vi.mocked(listFailedWithdrawals).mockResolvedValue([]);
    const { container } = renderPanel();
    await waitFor(() => expect(listFailedWithdrawals).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("API sem a rota (404): o painel não aparece", async () => {
    vi.mocked(listFailedWithdrawals).mockRejectedValue(apiError(404, "NOT_FOUND"));
    const { container } = renderPanel();
    await waitFor(() => expect(listFailedWithdrawals).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("reenvia com o motivo: só habilita com 5+ caracteres e avisa que o Pix cai em minutos", async () => {
    vi.mocked(listFailedWithdrawals).mockResolvedValue(ITEMS);
    vi.mocked(retryWithdrawal).mockResolvedValue({
      repasseId: "rep-1",
      vacancyId: "v",
      withdrawalStatus: "PENDING",
      failureReason: null,
    });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /Reenviar saque de R\$ 125,00/ }));

    const submit = screen.getByRole("button", { name: /Reenviar R\$ 125,00/ });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Por que reenviar? (obrigatório)"), {
      target: { value: "Bloqueio da Woovi liberado" },
    });
    fireEvent.click(submit);

    await waitFor(() => expect(retryWithdrawal).toHaveBeenCalledWith("rep-1", { reason: "Bloqueio da Woovi liberado" }));
    expect(retryWithdrawal).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(nbsp(toast.success.mock.calls[0][0])).toContain("Pix de Jaqueline Ribeiro cai em alguns minutos");
  });

  it("a Woovi recusou de novo: aviso para não insistir", async () => {
    vi.mocked(listFailedWithdrawals).mockResolvedValue(ITEMS);
    vi.mocked(retryWithdrawal).mockResolvedValue({
      repasseId: "rep-1",
      vacancyId: "v",
      withdrawalStatus: "FAILED",
      failureReason: "muitas chaves",
    });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /Reenviar saque de R\$ 125,00/ }));
    fireEvent.change(screen.getByLabelText("Por que reenviar? (obrigatório)"), { target: { value: "Teste de liberação" } });
    fireEvent.click(screen.getByRole("button", { name: /Reenviar R\$ 125,00/ }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    expect(toast.warning.mock.calls[0][0]).toContain("Não insista");
  });

  it("subconta sem o valor (409): mostra o erro no diálogo e diz que nada foi enviado", async () => {
    vi.mocked(listFailedWithdrawals).mockResolvedValue(ITEMS);
    vi.mocked(retryWithdrawal).mockRejectedValue(apiError(409, "SUBACCOUNT_BALANCE_MISSING"));
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /Reenviar saque de R\$ 80,00/ }));
    fireEvent.change(screen.getByLabelText("Por que reenviar? (obrigatório)"), { target: { value: "Teste de liberação" } });
    fireEvent.click(screen.getByRole("button", { name: /Reenviar R\$ 80,00/ }));

    expect(await screen.findByText(/não tem mais este valor/)).toBeInTheDocument();
    expect(screen.getByText(/Nada foi enviado/)).toBeInTheDocument();
  });
});

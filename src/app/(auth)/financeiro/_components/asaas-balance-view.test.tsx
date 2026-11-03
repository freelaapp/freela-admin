import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/admin/infrastructure/asaas-balance-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/admin/infrastructure/asaas-balance-api")>()),
  getAsaasBalance: vi.fn(),
  resolveAsaasTopup: vi.fn(),
}));

import {
  getAsaasBalance,
  resolveAsaasTopup,
  type AsaasBalanceOverview,
  type AsaasTopup,
} from "@/modules/admin/infrastructure/asaas-balance-api";
import { AsaasBalanceView } from "./asaas-balance-view";

function topup(overrides: Partial<AsaasTopup>): AsaasTopup {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    brasiliaDay: "2026-11-03",
    trigger: "SCHEDULE",
    status: "COMPLETED",
    skipReason: null,
    amountInCents: 4029,
    calculation: "saldo −R$ 10,29 → depósito 10,29 + 30,00 = 40,29",
    asaasBalanceBeforeInCents: -1029,
    asaasBalanceAfterInCents: 3000,
    wooviFreeBalanceInCents: 55200,
    destinationMasked: "b629…60d9",
    error: null,
    creditedAt: null,
    sentAt: null,
    settledAt: null,
    history: [],
    createdAt: "2026-11-03T15:07:00.000Z",
    ...overrides,
  };
}

function overview(overrides: Partial<AsaasBalanceOverview> = {}): AsaasBalanceOverview {
  return {
    asaasBalanceInCents: 289700,
    autoTopupEnabled: true,
    config: {
      valid: true,
      minBalanceInCents: 100000,
      amountInCents: 300000,
      maxPerDayInCents: 500000,
      maxPerMonthInCents: 1500000,
      pixKeyMasked: "b629…60d9",
    },
    asaasActivePixKeys: null,
    usage: { brasiliaDay: "2026-11-03", todayInCents: 400000, monthInCents: 700000, countedStatuses: "em andamento, concluída" },
    lastTopups: [topup({})],
    ...overrides,
  } as AsaasBalanceOverview;
}

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

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AsaasBalanceView />
    </QueryClientProvider>,
  );
}

const nbsp = (value: string | null | undefined) => (value ?? "").replace(/ /g, " ");

beforeEach(() => vi.clearAllMocks());

describe("AsaasBalanceView", () => {
  it("mostra o saldo com a fonte, a regra da recarga e os tetos", async () => {
    vi.mocked(getAsaasBalance).mockResolvedValue(overview());
    renderView();

    expect(await screen.findByText(/Saldo na Asaas agora — lido da Asaas às \d{2}:\d{2}/)).toBeInTheDocument();
    expect(nbsp(screen.getByText(/R\$ 2\.897,00$/).textContent)).toBe("R$ 2.897,00");
    expect(nbsp(document.body.textContent)).toContain("Recarrega quando o saldo fica abaixo de R$ 1.000,00.");
    expect(nbsp(document.body.textContent)).toContain("Hoje (03/11): R$ 4.000,00 de R$ 5.000,00");
    expect(nbsp(document.body.textContent)).toContain("Neste mês (11/2026): R$ 7.000,00 de R$ 15.000,00");
    expect(screen.getByText("ligada")).toBeInTheDocument();
  });

  it("saldo negativo aparece com sinal de menos e explica a recusa das notas", async () => {
    vi.mocked(getAsaasBalance).mockResolvedValue(overview({ asaasBalanceInCents: -1029 }));
    renderView();
    const section = await screen.findByRole("region", { name: "Saldo na Asaas" });
    expect(nbsp(within(section).getByText(/^−R\$ 10,29$/).textContent)).toBe("−R$ 10,29");
    expect(screen.getByText(/recusa as notas fiscais/)).toBeInTheDocument();
  });

  it("lista as recargas com o motivo das que não foram feitas", async () => {
    vi.mocked(getAsaasBalance).mockResolvedValue(
      overview({
        lastTopups: [
          topup({}),
          topup({
            id: "22222222-2222-2222-2222-222222222222",
            status: "SKIPPED",
            skipReason: "WOOVI_FREE_BALANCE_LOW",
            asaasBalanceAfterInCents: null,
          }),
        ],
      }),
    );
    renderView();
    expect(await screen.findByText("Concluída")).toBeInTheDocument();
    expect(screen.getByText("Não foi feita")).toBeInTheDocument();
    expect(screen.getByText(/A Woovi não tem saldo livre suficiente/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Resolver/ })).not.toBeInTheDocument();
  });

  it("sem tentativas, mostra o vazio", async () => {
    vi.mocked(getAsaasBalance).mockResolvedValue(overview({ lastTopups: [] }));
    renderView();
    expect(await screen.findByText(/Ainda não houve nenhuma tentativa de recarga/)).toBeInTheDocument();
  });

  it("mostra o carregando e depois o erro, com tentar de novo", async () => {
    vi.mocked(getAsaasBalance).mockRejectedValueOnce(apiError(403, "FORBIDDEN")).mockResolvedValue(overview());
    renderView();
    expect(screen.getByRole("status")).toHaveTextContent("Lendo o saldo na Asaas");
    expect(await screen.findByRole("alert")).toHaveTextContent("Só quem tem acesso ao Financeiro pode ver o saldo da Asaas.");
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByText("ligada")).toBeInTheDocument();
  });

  it("resolver: pede o que foi encontrado e o motivo, e só então envia", async () => {
    const unknown = topup({ id: "33333333-3333-3333-3333-333333333333", status: "UNKNOWN", asaasBalanceAfterInCents: null });
    vi.mocked(getAsaasBalance).mockResolvedValue(overview({ lastTopups: [unknown] }));
    vi.mocked(resolveAsaasTopup).mockResolvedValue({ id: unknown.id, status: "COMPLETED" });
    renderView();

    expect(await screen.findByText("1 recarga sem desfecho")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resolver recarga de R$ 40,29" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/não sabemos se o Pix chegou/)).toBeInTheDocument();
    const submit = within(dialog).getByRole("button", { name: "Resolver recarga" });
    expect(submit).toBeDisabled();

    fireEvent.click(within(dialog).getByLabelText(/O Pix chegou na Asaas/));
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Pix aparece no extrato da Asaas" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() =>
      expect(resolveAsaasTopup).toHaveBeenCalledWith(unknown.id, {
        outcome: "COMPLETED",
        reason: "Pix aparece no extrato da Asaas",
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("resolver: erro da API aparece em português e o diálogo continua aberto", async () => {
    const unknown = topup({ id: "44444444-4444-4444-4444-444444444444", status: "UNKNOWN" });
    vi.mocked(getAsaasBalance).mockResolvedValue(overview({ lastTopups: [unknown] }));
    vi.mocked(resolveAsaasTopup).mockRejectedValue(apiError(409, "TOPUP_STATUS_CHANGED"));
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /Resolver recarga de/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText(/O Pix não chegou/));
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Nada no extrato da Asaas" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Resolver recarga" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("mudou de estado");
    expect(resolveAsaasTopup).toHaveBeenCalledWith(unknown.id, { outcome: "FAILED", reason: "Nada no extrato da Asaas" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

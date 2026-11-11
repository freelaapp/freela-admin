import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getOrientationSettings: vi.fn(),
  getOrientationSummary: vi.fn(),
  updateOrientationSettings: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/orientation-api", async (orig) => ({ ...(await orig<object>()), ...api }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const auth = vi.hoisted(() => ({ isSuperAdmin: true }));
vi.mock("@/modules/auth/application/use-auth", () => ({ useAuth: () => auth }));

import ConfiguracoesOnboardingPage from "../page";

const settings = {
  gateMode: "OFF",
  newSignupsSince: null,
  gateFixedJobs: false,
  defaultCapacity: 15,
  maxCapacity: 20,
  defaultDurationMin: 60,
  bookingClosesMinBefore: 60,
  maxChanges: 2,
  maxNoShows: 2,
  sessionsShown: 4,
  joinOpensMinBefore: 15,
  resultGraceMin: 30,
  convocationMinDays: 7,
  dailyMessageCap: 200,
  updatedAt: null,
  updatedByAdminName: null,
};
const summary = {
  generatedAt: "2026-11-11T15:30:00.000Z",
  gateMode: "OFF",
  cutoff: "2026-11-11T15:30:00.000Z",
  cutoffStamped: false,
  freelancers: { active: 1000, approved: 40, rejected: 5, withoutGlobal: 10, pending: 955, pendingSinceCutoff: 7 },
  blockedByMode: { OFF: 5, NEW_ONLY: 12, ALL: 960 },
  booked: 0,
  queue: 955,
  nextSession: null,
};

function apiError(code: string, message: string) {
  const err = new AxiosError("fail");
  err.response = { data: { error: { code, message } } } as AxiosError["response"];
  return err;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ConfiguracoesOnboardingPage />
    </QueryClientProvider>,
  );
}

describe("Configurações do Onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.isSuperAdmin = true;
    api.getOrientationSettings.mockResolvedValue(settings);
    api.getOrientationSummary.mockResolvedValue(summary);
    api.updateOrientationSettings.mockResolvedValue(settings);
  });

  it("admin comum vê os 3 cartões sem botão de mudar e com a dica", async () => {
    auth.isSuperAdmin = false;
    renderPage();
    expect(await screen.findByText("Todos veem vagas, menos os reprovados.")).toBeInTheDocument();
    expect(screen.getByText("Só os aprovados veem vagas.")).toBeInTheDocument();
    expect(screen.getByText(/Quem virar freelancer a partir de/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Usar este modo/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Só super administradores podem mudar.").length).toBeGreaterThan(0);
    expect(screen.queryByRole("switch", { name: /vagas fixas/ })).not.toBeInTheDocument();
    expect(screen.getByText("Ninguém alterou ainda")).toBeInTheDocument();
  });

  it("ALL: só habilita depois de digitar TODOS e manda só o gateMode", async () => {
    renderPage();
    await screen.findByText("Só os aprovados veem vagas.");
    fireEvent.click(screen.getAllByRole("button", { name: /Usar este modo/ })[1]);
    const confirm = await screen.findByRole("button", { name: "Esconder vagas de 955 pessoas" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Digite TODOS/), { target: { value: "TODOS" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(api.updateOrientationSettings).toHaveBeenCalledWith({ gateMode: "ALL" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Modo alterado. Vale em até 1 minuto."));
  });

  it("salvar os padrões manda só o que mudou", async () => {
    renderPage();
    const field = await screen.findByLabelText("Trocas de horário permitidas");
    fireEvent.change(field, { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar padrões" }));
    await waitFor(() => expect(api.updateOrientationSettings).toHaveBeenCalledWith({ maxChanges: 4 }));
  });

  it("erro 400 aparece pela tabela de erros", async () => {
    api.updateOrientationSettings.mockRejectedValue(apiError("BAD_REQUEST", "maxChanges must not be greater than 1000"));
    renderPage();
    const field = await screen.findByLabelText("Trocas de horário permitidas");
    fireEvent.change(field, { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar padrões" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Algum campo está fora do formato: maxChanges must not be greater than 1000",
      ),
    );
  });

  it("chave das vagas fixas manda só gateFixedJobs", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("switch", { name: /vagas fixas/ }));
    await waitFor(() => expect(api.updateOrientationSettings).toHaveBeenCalledWith({ gateFixedJobs: true }));
  });
});

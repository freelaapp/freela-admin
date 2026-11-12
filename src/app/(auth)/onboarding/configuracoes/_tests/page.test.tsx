import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getOrientationSettings: vi.fn(),
  getOrientationSummary: vi.fn(),
  updateOrientationSettings: vi.fn(),
  getOrientationReadiness: vi.fn(),
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
  gateWired: true,
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

describe("Configurações do Onboarding — trava não ligada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.isSuperAdmin = true;
    api.getOrientationSummary.mockResolvedValue(summary);
  });

  it.each([{ gateWired: false }, { gateWired: undefined }])(
    "gateWired %o: Só cadastros novos e Todos ficam desativados com o motivo",
    async (over) => {
      api.getOrientationSettings.mockResolvedValue({ ...settings, ...over });
      renderPage();
      const buttons = await screen.findAllByRole("button", { name: "Usar este modo" });
      expect(buttons).toHaveLength(2);
      buttons.forEach((b) => expect(b).toBeDisabled());
      expect(screen.getAllByText("Disponível quando a trava de vagas for ligada no servidor.")).toHaveLength(2);
      expect(await screen.findByText("Ninguém é barrado: o resultado da aula só fica registrado.")).toBeInTheDocument();
    },
  );

  it("OFF continua disponível quando já está em outro modo", async () => {
    api.getOrientationSettings.mockResolvedValue({ ...settings, gateMode: "ALL", gateWired: false });
    renderPage();
    const buttons = await screen.findAllByRole("button", { name: "Usar este modo" });
    expect(buttons[0]).toBeEnabled();
  });
});

describe("Configurações do Onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.isSuperAdmin = true;
    api.getOrientationSettings.mockResolvedValue(settings);
    api.getOrientationSummary.mockResolvedValue(summary);
    api.updateOrientationSettings.mockResolvedValue(settings);
    api.getOrientationReadiness.mockResolvedValue(null);
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

  it("sem os números: ainda dá para desligar; ligar mostra que não deu para contar e não envia", async () => {
    api.getOrientationSummary.mockRejectedValue(new Error("falhou"));
    api.getOrientationSettings.mockResolvedValue({ ...settings, gateMode: "ALL" });
    renderPage();
    fireEvent.click((await screen.findAllByRole("button", { name: "Usar este modo" }))[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Desligar o bloqueio" }));
    await waitFor(() => expect(api.updateOrientationSettings).toHaveBeenCalledWith({ gateMode: "OFF" }));
  });

  it("sem os números: NEW_ONLY e ALL mostram o aviso e não enviam nada", async () => {
    api.getOrientationSummary.mockRejectedValue(new Error("falhou"));
    renderPage();
    const buttons = await screen.findAllByRole("button", { name: "Usar este modo" });
    fireEvent.click(buttons[1]);
    expect(await screen.findByText("Não consegui contar quem perde as vagas agora. Tente de novo.")).toBeInTheDocument();
    expect(api.updateOrientationSettings).not.toHaveBeenCalled();
  });

  it("a edição dos padrões sobrevive a uma mudança de configuração feita por outro lado", async () => {
    renderPage();
    const field = await screen.findByLabelText("Trocas de horário permitidas");
    fireEvent.change(field, { target: { value: "9" } });
    api.getOrientationSettings.mockResolvedValue({ ...settings, gateFixedJobs: true, updatedAt: "2026-11-11T16:00:00Z", updatedByAdminName: "Ana" });
    fireEvent.click(await screen.findByRole("switch", { name: /vagas fixas/ }));
    await waitFor(() => expect(api.updateOrientationSettings).toHaveBeenCalledWith({ gateFixedJobs: true }));
    await screen.findByText(/Configuração alterada por Ana/);
    expect(screen.getByLabelText("Trocas de horário permitidas")).toHaveValue("9");
  });

  it("enquanto os números carregam: o cartão e o botão de desligar já aparecem e funcionam", async () => {
    api.getOrientationSummary.mockReturnValue(new Promise(() => {}));
    api.getOrientationSettings.mockResolvedValue({ ...settings, gateMode: "ALL" });
    renderPage();
    fireEvent.click((await screen.findAllByRole("button", { name: "Usar este modo" }))[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Desligar o bloqueio" }));
    await waitFor(() => expect(api.updateOrientationSettings).toHaveBeenCalledWith({ gateMode: "OFF" }));
  });

  it("salvar manda só o que esta pessoa editou, sem desfazer a mudança de outro admin", async () => {
    renderPage();
    const duration = await screen.findByLabelText("Duração da aula (min)");
    fireEvent.change(duration, { target: { value: "90" } });
    api.getOrientationSettings.mockResolvedValue({ ...settings, maxChanges: 4, updatedAt: "2026-11-11T16:00:00Z", updatedByAdminName: "Bia" });
    fireEvent.click(await screen.findByRole("switch", { name: /vagas fixas/ }));
    await screen.findByText(/Configuração alterada por Bia/);
    api.updateOrientationSettings.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Salvar padrões" }));
    await waitFor(() => expect(api.updateOrientationSettings).toHaveBeenCalledWith({ defaultDurationMin: 90 }));
  });
});

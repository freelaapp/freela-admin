import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getOrientationReadiness: vi.fn() }));
vi.mock("@/modules/admin/infrastructure/orientation-api", async (orig) => ({ ...(await orig<object>()), ...api }));

import type { ModeChangeDialog as Info } from "@/modules/admin/application/orientation-mode";
import { ModeChangeDialog } from "../_components/mode-change-dialog";

const infoAll: Info = {
  title: "Mudar para Todos",
  lines: ["Esconde vagas de 955 pessoas."],
  confirmLabel: "Esconder vagas de 955 pessoas",
  requiresTyping: "TODOS",
  losing: 955,
};
const infoNew: Info = { ...infoAll, title: "Mudar para Só cadastros novos", requiresTyping: null, confirmLabel: "Mudar" };

const city = (name: string, open: number, approved: number) => ({
  uf: "SP",
  city: name,
  openVacancies: open,
  approvedRecentApplicants: approved,
  ok: approved >= open,
});
function readiness(over: { value?: string; ok?: boolean; cities?: ReturnType<typeof city>[] } = {}) {
  const cities = over.cities ?? [city("Campinas", 2, 5)];
  const gap = cities.filter((c) => !c.ok).length;
  return {
    generatedAt: "2026-11-11T15:00:00.000Z",
    appMinimum: { value: over.value ?? "1.0.50", required: "1.0.50", ok: over.ok ?? true, source: "env APP_MINIMUM_VERSION" },
    supply: {
      windowDays: 14,
      recentDays: 30,
      cities,
      openWithoutCity: 0,
      citiesWithGap: gap,
      ok: gap === 0,
      formula: "Cidade ok quando aprovados >= vagas.",
      source: "bares_restaurantes.vacancies",
    },
  };
}

const onConfirm = vi.fn();
function renderDialog(info: Info) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ModeChangeDialog info={info} pending={false} onConfirm={onConfirm} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}
const LABEL_APP = /App mínimo ≥ 1\.0\.50/;
const RED = "Há conferência com problema. Ligar mesmo assim esconde vagas onde falta gente.";

describe("Diálogo do modo Todos: conferências", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("alvo ALL com readiness ok: dois ✓ (com texto) e nenhuma linha vermelha", async () => {
    api.getOrientationReadiness.mockResolvedValue(readiness());
    renderDialog(infoAll);
    const list = await screen.findByRole("list", { name: "Conferências antes de ligar o Todos" });
    await waitFor(() => expect(within(list).getAllByText("Ok")).toHaveLength(2));
    expect(within(list).getByText(LABEL_APP)).toBeInTheDocument();
    expect(within(list).getByText(/Hoje: 1\.0\.50 \(APP_MINIMUM_VERSION no servidor\)/)).toBeInTheDocument();
    expect(screen.queryByText(RED)).not.toBeInTheDocument();
  });

  it("app mínimo 1.0.49: ✗ com a versão de hoje e linha vermelha", async () => {
    api.getOrientationReadiness.mockResolvedValue(readiness({ value: "1.0.49", ok: false }));
    renderDialog(infoAll);
    expect(await screen.findByText(/Hoje: 1\.0\.49 \(APP_MINIMUM_VERSION no servidor\)/)).toBeInTheDocument();
    expect(screen.getAllByText("Falhou").length).toBeGreaterThan(0);
    expect(screen.getByText(RED)).toBeInTheDocument();
  });

  it("falta de aprovados: mostra até 5 cidades e 'Ver todas' abre o resto", async () => {
    const cities = ["A", "B", "C", "D", "E", "F", "G"].map((n, i) => city(n, 20, i));
    api.getOrientationReadiness.mockResolvedValue(readiness({ cities }));
    renderDialog(infoAll);
    await screen.findByText(/A\/SP: 20 vagas abertas, 0 aprovados ativos/);
    expect(screen.queryByText(/G\/SP: 20 vagas abertas, 6 aprovados ativos/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver todas (7)" }));
    expect(screen.getByText(/G\/SP: 20 vagas abertas, 6 aprovados ativos/)).toBeInTheDocument();
    expect(screen.getByText(RED)).toBeInTheDocument();
  });

  it("readiness com erro 503: '?' e 'Não deu para conferir agora.'; o botão ainda libera com TODOS", async () => {
    const err = new AxiosError("x");
    err.response = { status: 503, data: { code: "READINESS_UNAVAILABLE", message: "m" } } as AxiosError["response"];
    api.getOrientationReadiness.mockRejectedValue(err);
    renderDialog(infoAll);
    expect(await screen.findByText("Não deu para conferir agora.")).toBeInTheDocument();
    expect(screen.getByText("Sem conferência")).toBeInTheDocument();
    expect(screen.getByText(RED)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: infoAll.confirmLabel });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Digite TODOS/), { target: { value: "TODOS" } });
    expect(confirm).toBeEnabled();
  });

  it("tudo ✓ e mesmo assim o botão só libera com TODOS", async () => {
    api.getOrientationReadiness.mockResolvedValue(readiness());
    renderDialog(infoAll);
    await screen.findByText(LABEL_APP);
    const confirm = screen.getByRole("button", { name: infoAll.confirmLabel });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Digite TODOS/), { target: { value: "TODOS" } });
    expect(confirm).toBeEnabled();
  });

  it("enquanto confere, o botão não espera a conferência", async () => {
    api.getOrientationReadiness.mockReturnValue(new Promise(() => {}));
    renderDialog(infoAll);
    expect(await screen.findByText("Conferindo…")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Digite TODOS/), { target: { value: "TODOS" } });
    expect(screen.getByRole("button", { name: infoAll.confirmLabel })).toBeEnabled();
  });

  it("alvo NEW_ONLY não chama readiness nem mostra a lista", () => {
    renderDialog(infoNew);
    expect(api.getOrientationReadiness).not.toHaveBeenCalled();
    expect(screen.queryByRole("list", { name: /Conferências/ })).not.toBeInTheDocument();
  });
});

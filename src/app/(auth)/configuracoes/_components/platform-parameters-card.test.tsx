import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlatformParametersCard } from "./platform-parameters-card";

const api = vi.hoisted(() => ({
  getPlatformParameters: vi.fn(),
  updatePlatformParameter: vi.fn(),
  getParameterChanges: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/platform-parameters-api", async (orig) => ({
  ...(await orig<object>()),
  ...api,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const auth = vi.hoisted(() => ({ isSuperAdmin: true }));
vi.mock("@/modules/auth/application/use-auth", () => ({ useAuth: () => auth }));

const PARAM = {
  key: "ranking.worked_here_cap_pct",
  label: "Já trabalhou aqui: teto",
  help: "Entre os 10 pré-selecionados.",
  unit: "%",
  value: 50,
  defaultValue: 50,
  min: 0,
  max: 100,
  isDefault: true,
  inEffect: true,
  version: 0,
  updatedAt: null,
  updatedBy: null,
};

function apiError(status: number, code: string, message: string, fields?: object) {
  const err = new AxiosError("fail");
  err.response = {
    status,
    data: { error: { code, message, ...(fields ? { fields } : {}) } },
  } as AxiosError["response"];
  return err;
}

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PlatformParametersCard />
    </QueryClientProvider>,
  );
}

async function openEdit() {
  fireEvent.click(await screen.findByRole("button", { name: /Alterar/ }));
}

describe("PlatformParametersCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.isSuperAdmin = true;
    api.getPlatformParameters.mockResolvedValue([PARAM]);
    api.getParameterChanges.mockResolvedValue([]);
  });

  it("mostra valor, padrão, faixa, estado, teto em vagas e valor inicial", async () => {
    renderCard();
    expect(await screen.findByText("Já trabalhou aqui: teto")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText(/teto 50%/)).toBeInTheDocument();
    expect(screen.getByText(/Padrão: 50%/)).toBeInTheDocument();
    expect(screen.getByText(/Faixa: 0 a 100/)).toBeInTheDocument();
    expect(screen.getByText("Em vigor")).toBeInTheDocument();
    expect(screen.getByText("Valor inicial (ninguém alterou)")).toBeInTheDocument();
  });

  it("chave V3 desligada: Guardado; regra desligada", async () => {
    api.getPlatformParameters.mockResolvedValue([{ ...PARAM, inEffect: false }]);
    renderCard();
    expect(await screen.findByText("Guardado; regra desligada")).toBeInTheDocument();
  });

  it("mostra a última mudança", async () => {
    api.getPlatformParameters.mockResolvedValue([
      {
        ...PARAM,
        value: 30,
        isDefault: false,
        version: 2,
        updatedAt: "2026-11-23T17:05:00.000Z",
        updatedBy: "Ana Lima",
      },
    ]);
    renderCard();
    expect(await screen.findByText(/Alterado por Ana Lima em 23\/11\/2026/)).toBeInTheDocument();
  });

  it("não é super-admin: só leitura, com a dica, sem botão Alterar; Histórico continua", async () => {
    auth.isSuperAdmin = false;
    renderCard();
    expect(await screen.findByText("Já trabalhou aqui: teto")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Alterar/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Só super administradores podem mudar/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Histórico/ })).toBeInTheDocument();
  });

  it("diálogo: Salvar só com valor novo e motivo; envia value, reason e expectedVersion", async () => {
    api.updatePlatformParameter.mockResolvedValue({ ...PARAM, value: 30, version: 2, isDefault: false });
    renderCard();
    await openEdit();
    const save = screen.getByRole("button", { name: /^Salvar/ });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Novo valor"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "abc" } });
    expect(screen.getByText("Conte o motivo em pelo menos 5 letras.")).toBeInTheDocument();
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "Pedido do Diego" } });
    expect(screen.getByRole("button", { name: "Salvar 30%" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Salvar 30%" }));
    await waitFor(() =>
      expect(api.updatePlatformParameter).toHaveBeenCalledWith("ranking.worked_here_cap_pct", {
        value: 30,
        reason: "Pedido do Diego",
        expectedVersion: 0,
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.success.mock.calls[0][0]).toContain("30%");
  });

  it("diálogo tem altura limitada com rolagem", async () => {
    renderCard();
    await openEdit();
    expect(screen.getByTestId("parameter-dialog-body").className).toContain("max-h-[55vh]");
    expect(screen.getByTestId("parameter-dialog-body").className).toContain("overflow-y-auto");
  });

  it("valor igual ao de hoje: avisa e não deixa salvar", async () => {
    renderCard();
    await openEdit();
    fireEvent.change(screen.getByLabelText("Novo valor"), { target: { value: "50" } });
    expect(screen.getByText("É o valor de hoje.")).toBeInTheDocument();
  });

  it("422 mostra o erro do campo da API e mantém o que foi digitado", async () => {
    api.updatePlatformParameter.mockRejectedValue(
      apiError(422, "PARAMETER_INVALID", "Valor fora da faixa.", { value: "Use um número entre 0 e 100." }),
    );
    renderCard();
    await openEdit();
    fireEvent.change(screen.getByLabelText("Novo valor"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "Pedido do Diego" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar 30%" }));
    expect(await screen.findByText("Use um número entre 0 e 100.")).toBeInTheDocument();
    expect(screen.getByLabelText("Novo valor")).toHaveValue(30);
    expect(screen.getByLabelText(/Motivo/)).toHaveValue("Pedido do Diego");
  });

  it("409 pede para conferir e recarrega", async () => {
    api.updatePlatformParameter.mockRejectedValue(
      apiError(409, "PARAMETER_CHANGED_MEANWHILE", "Mudou."),
    );
    renderCard();
    await openEdit();
    fireEvent.change(screen.getByLabelText("Novo valor"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "Pedido do Diego" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar 30%" }));
    expect(await screen.findByText(/mudou este valor agora há pouco/)).toBeInTheDocument();
    await waitFor(() => expect(api.getPlatformParameters).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Novo valor")).toHaveValue(30);
  });

  it("falha genérica: mensagem junto do botão e dados mantidos", async () => {
    api.updatePlatformParameter.mockRejectedValue(new Error("rede"));
    renderCard();
    await openEdit();
    fireEvent.change(screen.getByLabelText("Novo valor"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "Pedido do Diego" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar 30%" }));
    expect(await screen.findByText(/Não foi possível salvar/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo/)).toHaveValue("Pedido do Diego");
  });

  it("histórico: lista as mudanças; vazio mostra o valor inicial", async () => {
    api.getParameterChanges.mockResolvedValue([
      {
        oldValue: 50,
        newValue: 30,
        defaultValue: 50,
        reason: "Pedido do Diego",
        admin: "Ana Lima",
        createdAt: "2026-11-23T17:05:00.000Z",
      },
    ]);
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: /Histórico/ }));
    expect(await screen.findByText(/Ana Lima · 50% → 30% · "Pedido do Diego"/)).toBeInTheDocument();
  });

  it("histórico vazio", async () => {
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: /Histórico/ }));
    expect(await screen.findByText("Nenhuma mudança ainda. Valor inicial: 50%.")).toBeInTheDocument();
  });

  it("erro de leitura: mensagem e Tentar de novo", async () => {
    api.getPlatformParameters.mockRejectedValueOnce(new Error("x"));
    renderCard();
    expect(await screen.findByText("Não foi possível atualizar agora.")).toBeInTheDocument();
    api.getPlatformParameters.mockResolvedValue([PARAM]);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Já trabalhou aqui: teto")).toBeInTheDocument();
  });
});

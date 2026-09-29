import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FixedJobTrialAdmin } from "@/modules/admin/domain/fixed-job-trial";

import { FixedJobTrialSection } from "./fixed-job-trial-section";

const api = vi.hoisted(() => ({
  grantFixedJobTrial: vi.fn(),
  updateFixedJobTrial: vi.fn(),
  revokeFixedJobTrial: vi.fn(),
}));

vi.mock("@/modules/admin/infrastructure/subscriptions-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...api,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ACTIVE: FixedJobTrialAdmin = {
  id: "trial-1",
  quota: 2,
  used: 1,
  remaining: 1,
  expiresAt: "2026-10-14T02:59:59.999Z", // 13/10 em Brasília
  status: "ACTIVE",
  note: null,
  grantedAt: "2026-09-29T12:00:00.000Z",
  grantedByEmail: "ops@freela.com",
  revokedAt: null,
  revokedByEmail: null,
};

const EXPIRED: FixedJobTrialAdmin = {
  ...ACTIVE,
  expiresAt: "2026-09-20T02:59:59.999Z", // 19/09 em Brasília
  status: "EXPIRED",
};

function renderSection(trial: FixedJobTrialAdmin) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FixedJobTrialSection storeId="store-1" planCode="FREE" trial={trial} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.revokeFixedJobTrial.mockResolvedValue({ ...ACTIVE, status: "REVOKED" });
  api.updateFixedJobTrial.mockResolvedValue(ACTIVE);
  // Só o relógio: o "hoje" de Brasília é 29/09/2026.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-29T13:00:00.000Z"));
});

afterEach(() => vi.useRealTimers());

describe("FixedJobTrialSection — encerrar pede confirmação", () => {
  it("o clique em 'Encerrar teste' só abre a confirmação; encerra ao confirmar", async () => {
    renderSection(ACTIVE);

    fireEvent.click(screen.getByRole("button", { name: /encerrar teste/i }));

    expect(api.revokeFixedJobTrial).not.toHaveBeenCalled();
    expect(screen.getByText("Encerrar o teste de vaga fixa?")).toBeInTheDocument();
    // Diz o que acontece: usou 1 de 2 e o que já foi publicado continua.
    expect(
      screen.getByText(/Encerra agora, com 1 de 2 vagas usadas.*já publicadas continuam/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sim, encerrar" }));

    await waitFor(() => expect(api.revokeFixedJobTrial).toHaveBeenCalledTimes(1));
    expect(api.revokeFixedJobTrial.mock.calls[0][0]).toBe("store-1");
    await waitFor(() =>
      expect(screen.queryByText("Encerrar o teste de vaga fixa?")).not.toBeInTheDocument(),
    );
  });

  it("'Voltar' fecha sem encerrar", () => {
    renderSection(ACTIVE);

    fireEvent.click(screen.getByRole("button", { name: /encerrar teste/i }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.queryByText("Encerrar o teste de vaga fixa?")).not.toBeInTheDocument();
    expect(api.revokeFixedJobTrial).not.toHaveBeenCalled();
  });
});

describe("FixedJobTrialSection — teste vencido precisa de data nova", () => {
  it("avisa e não deixa salvar só o total; com data de hoje em diante, salva e reativa", async () => {
    renderSection(EXPIRED);

    expect(screen.getByText(/nova data/i)).toBeInTheDocument();
    const save = screen.getByRole("button", { name: /salvar alteração/i });

    fireEvent.change(screen.getByLabelText("Total de vagas"), { target: { value: "3" } });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Vale até"), { target: { value: "2026-09-25" } });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Vale até"), { target: { value: "2026-10-05" } });
    expect(save).toBeEnabled();
    expect(screen.queryByText(/nova data/i)).not.toBeInTheDocument();

    fireEvent.click(save);
    await waitFor(() =>
      expect(api.updateFixedJobTrial).toHaveBeenCalledWith("store-1", {
        quota: 3,
        expiresOn: "2026-10-05",
      }),
    );
  });

  it("teste ativo não mostra o aviso e salva só o total", () => {
    renderSection(ACTIVE);

    expect(screen.queryByText(/nova data/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Total de vagas"), { target: { value: "3" } });
    expect(screen.getByRole("button", { name: /salvar alteração/i })).toBeEnabled();
  });
});

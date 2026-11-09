import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminPrestartCheckItem } from "@/modules/admin/infrastructure/admin-api";

const { getChecks } = vi.hoisted(() => ({ getChecks: vi.fn() }));

vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("@/modules/admin/application/use-admin-cancel-vacancy", () => ({ getAxiosErrorMessage: () => "erro" }));
vi.mock("@/modules/admin/application/use-vacancy-candidacies", () => ({
  useConfirmPrestartByPhone: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/modules/admin/infrastructure/admin-api", () => ({ getAdminPrestartChecks: getChecks }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import ConfirmacaoDoDiaPage from "./page";

const check = (over: Partial<AdminPrestartCheckItem> = {}): AdminPrestartCheckItem => ({
  id: "pc-1",
  candidacyId: "cand-1",
  vacancyId: "vac-1",
  vacancyTitle: "Garçom",
  companyName: "Bar do Zé",
  startTime: "2026-11-09T21:00:00.000Z",
  contractorAlertedAt: null,
  providerName: "Ana Souza",
  providerPhone: "+5511999990000",
  status: "SENT",
  skipReason: null,
  voidReason: null,
  sentAt: "2026-11-09T18:00:00.000Z",
  deadlineAt: "2026-11-09T19:30:00.000Z",
  answeredAt: null,
  answerChannel: null,
  answeredLate: false,
  contractorDecision: null,
  ...over,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConfirmacaoDoDiaPage />
    </QueryClientProvider>,
  );
}

describe("/confirmacao-do-dia: sinal de chegada", () => {
  beforeEach(() => vi.clearAllMocks());

  it("com arrivalSignal: o texto aparece discreto no cartão do freelancer", async () => {
    getChecks.mockResolvedValue([check({ arrivalSignal: { text: "Sem leitura às 17h32: permissão de localização negada (site)" } })]);
    renderPage();
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByTestId("arrival-signal")).toHaveTextContent(
      "Sem leitura às 17h32: permissão de localização negada (site)",
    );
  });

  it("sem o campo (API antiga) ou com null: nada aparece", async () => {
    getChecks.mockResolvedValue([check(), check({ id: "pc-2", candidacyId: "cand-2", arrivalSignal: null })]);
    renderPage();
    expect((await screen.findAllByText("Ana Souza")).length).toBe(2);
    expect(screen.queryByTestId("arrival-signal")).not.toBeInTheDocument();
  });
});

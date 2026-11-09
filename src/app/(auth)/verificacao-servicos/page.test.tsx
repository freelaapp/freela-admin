import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AttendanceFlowItem, SystemHealth } from "@/modules/admin/infrastructure/system-health-api";

const state = vi.hoisted(() => ({ items: [] as unknown[] }));
const idle = vi.hoisted(() => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false }));

vi.mock("@/modules/auth/application/use-auth", () => ({ useAuth: () => ({ isSuperAdmin: false }) }));
vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("@/modules/admin/application/use-admin-system-health", () => ({
  useSystemHealth: () => ({
    data: {
      generatedAt: "2026-11-09T20:00:00.000Z",
      channels: [],
      providers: [],
      schedulers: [],
      attendance: { pendingContractor: 0, contested: 0, supportTickets: 0, items: [] },
      systemScore: { avg30d: null, count30d: 0 },
    } satisfies SystemHealth,
    isLoading: false,
    isError: false,
    isFetching: false,
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  }),
  useAttendanceFlows: () => ({
    data: state.items,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useResolveAttendance: () => idle,
  useSendAdminAlertTest: () => idle,
}));
vi.mock("@/modules/admin/application/use-admin-whatsapp-chips", () => ({
  useWhatsAppChips: () => ({ data: [], isLoading: false, isError: false }),
  useSendWhatsAppChipTest: () => idle,
}));
vi.mock("@/modules/admin/application/use-admin-cancel-vacancy", () => ({ getAxiosErrorMessage: () => "erro" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import VerificacaoServicosPage from "./page";

const item = (over: Partial<AttendanceFlowItem> = {}): AttendanceFlowItem => ({
  jobId: "job-1",
  vacancyId: "vac-12345678",
  vacancyTitle: "Garçom",
  contractorName: "Bar do Zé",
  providerName: "Ana Souza",
  status: "PENDING_CONTRACTOR_CONFIRMATION",
  contractorReason: "Não apareceu",
  openedAt: "2026-11-09T20:00:00.000Z",
  ...over,
});

describe("/verificacao-servicos: sinal de chegada nas contestações", () => {
  beforeEach(() => {
    state.items = [];
  });

  it("com arrivalSignal: o texto aparece discreto na linha da contestação e no diálogo de resolver", () => {
    state.items = [item({ arrivalSignal: { text: "Chegou às 17h32, a 80 m (app)" } })];
    render(<VerificacaoServicosPage />);
    // A tabela pode ter uma versão para o celular: basta o texto estar na linha.
    for (const line of screen.getAllByTestId("arrival-signal")) {
      expect(line).toHaveTextContent("Chegou às 17h32, a 80 m (app)");
    }

    const naTabela = screen.getAllByTestId("arrival-signal").length;
    fireEvent.click(screen.getAllByRole("button", { name: "Resolver" })[0]);
    expect(screen.getByText("Resolver contestação")).toBeInTheDocument();
    // Com o diálogo aberto, o mesmo texto aparece também nele.
    expect(screen.getAllByTestId("arrival-signal")).toHaveLength(naTabela + 1);
  });

  it("sem o campo (API antiga) ou com null: nada aparece", () => {
    state.items = [item(), item({ jobId: "job-2", arrivalSignal: null })];
    render(<VerificacaoServicosPage />);
    expect(screen.getAllByText("Garçom").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("arrival-signal")).not.toBeInTheDocument();
  });
});

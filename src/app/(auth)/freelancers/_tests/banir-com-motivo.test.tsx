import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D5, fatia C3 (E4): banir e desbanir pedem o motivo da lista fixa (D7) e mostram o último
 * registro (quem baniu, quando e por quê).
 */
const { state, mutation } = vi.hoisted(() => ({
  state: { banned: false, mutateAsync: vi.fn() },
  mutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const row = {
  id: "prov-1",
  userId: "user-1",
  providerGlobalId: "pg-1",
  name: "Ana Souza",
  phone: null,
  email: null,
  jobTitle: "garcom",
  services: ["garcom"],
  bio: null,
  city: "Osasco",
  uf: "SP",
  isActive: true,
  createdAt: "2026-09-01T12:00:00.000Z",
  trabalhos: 0,
  avaliacao: null,
  score: 50,
};

vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("@/modules/admin/application/use-admin-providers", () => ({
  useAdminProviders: () => ({
    data: {
      data: [{ ...row, banned: state.banned, isActive: !state.banned }],
      total: 1,
    },
    isLoading: false,
    isError: false,
    isFetching: false,
  }),
  useAdminBanFreelancer: () => ({ mutateAsync: state.mutateAsync, isPending: false }),
  useProvidersFilterOptions: () => ({ data: { ufs: [], cities: [], services: [] } }),
  useClearLowPriority: mutation,
}));
vi.mock("@/modules/admin/application/use-providers-status-counts", () => ({
  useProvidersStatusCounts: () => ({ data: undefined }),
}));
vi.mock("@/modules/admin/application/use-admin-update-provider", () => ({ useAdminUpdateProvider: mutation }));
vi.mock("@/modules/admin/application/use-cities-catalog", () => ({ useCitiesCatalog: () => ({ data: [] }) }));
vi.mock("@/modules/admin/application/use-admin-catalog", () => ({ useCatalogRoles: () => ({ data: [] }) }));
vi.mock("@/modules/admin/application/use-export-providers", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useExportProviders: () => ({ exportCsv: vi.fn(), isExporting: false }),
}));
vi.mock("@/modules/admin/infrastructure/admin-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getFreelancerAccessEvents: vi.fn(async () => [
    {
      id: "ev-1",
      action: "UNBAN",
      reason: "MISTAKE",
      note: null,
      adminName: "Bia",
      createdAt: "2026-11-10T15:00:00.000Z",
    },
  ]),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("../_components/completeness-card", () => ({ CompletenessCard: () => null }));
vi.mock("@/components/admin/orientation/orientation-provider-section", () => ({ OrientationProviderSection: () => null }));
vi.mock("@/components/admin/provider/pix-key-replace-section", () => ({ PixKeyReplaceSection: () => null }));
vi.mock("@/components/admin/excluir-usuario-dialog", () => ({ ExcluirUsuarioPanel: () => null }));

import FreelancersPage from "../page";

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FreelancersPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.banned = false;
  state.mutateAsync = vi.fn(async () => ({}));
});

describe("Freelancers: banir com motivo (D5, fatia C3)", () => {
  it("sem motivo não bane; com motivo manda o motivo e a nota", async () => {
    renderPage();
    fireEvent.click(screen.getAllByTitle("Bloquear")[0]);
    expect(await screen.findByText("Último registro: Desbanido por Bia em 10/11: o bloqueio foi um engano.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Banir definitivamente" }));
    expect(screen.getByText("Escolha o motivo do bloqueio.")).toBeInTheDocument();
    expect(state.mutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "Faltas sem aviso em serviços confirmados" }));
    fireEvent.change(screen.getByLabelText(/Nota interna/), { target: { value: "3 faltas em 20 dias" } });
    fireEvent.click(screen.getByRole("button", { name: "Banir definitivamente" }));
    await waitFor(() =>
      expect(state.mutateAsync).toHaveBeenCalledWith({
        userId: "user-1",
        banned: true,
        reason: "NO_SHOWS",
        note: "3 faltas em 20 dias",
      }),
    );
  });

  it('desbanir com "Outro motivo" pede a nota', async () => {
    state.banned = true;
    renderPage();
    fireEvent.click(screen.getAllByTitle("Desbanir")[0]);
    fireEvent.click(await screen.findByRole("radio", { name: "Outro motivo (escreva na nota)" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Desbanir" }).at(-1)!);
    expect(screen.getByText('Com "Outro motivo", escreva a nota.')).toBeInTheDocument();
    expect(state.mutateAsync).not.toHaveBeenCalled();
  });
});

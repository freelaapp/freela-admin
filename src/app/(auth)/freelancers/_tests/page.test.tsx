import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { ProviderExportItem } from "@/modules/admin/infrastructure/providers-export-api";

const { mutation } = vi.hoisted(() => ({
  mutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const ana = {
  id: "prov-1",
  userId: "user-1",
  providerGlobalId: "pg-1",
  name: "Ana Souza",
  phone: "+5532999990000",
  email: "ana@exemplo.com",
  jobTitle: "garcom",
  services: ["garcom"],
  bio: "Trabalho com eventos há 5 anos.",
  city: "Juiz de Fora",
  uf: "MG",
  isActive: true,
  createdAt: "2026-09-01T12:00:00.000Z",
  trabalhos: 4,
  avaliacao: 4.8,
  score: 90,
} as unknown as ProviderExportItem;

vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("@/modules/admin/application/use-admin-providers", () => ({
  useAdminProviders: () => ({ data: { data: [ana], total: 1 }, isLoading: false, isError: false, isFetching: false }),
  useAdminBanFreelancer: mutation,
  useProvidersFilterOptions: () => ({ data: { ufs: [], cities: [], services: [] } }),
  useClearLowPriority: mutation,
}));
vi.mock("@/modules/admin/application/use-admin-update-provider", () => ({ useAdminUpdateProvider: mutation }));
vi.mock("@/modules/admin/application/use-cities-catalog", () => ({ useCitiesCatalog: () => ({ data: [] }) }));
vi.mock("@/modules/admin/application/use-admin-catalog", () => ({ useCatalogRoles: () => ({ data: [] }) }));
vi.mock("@/modules/admin/application/use-export-providers", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useExportProviders: () => ({ exportCsv: vi.fn(), isExporting: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Peças com dados próprios: fora do escopo deste teste.
vi.mock("../_components/completeness-card", () => ({ CompletenessCard: () => null }));
vi.mock("@/components/admin/provider/pix-key-replace-section", () => ({ PixKeyReplaceSection: () => null }));
vi.mock("@/components/admin/excluir-usuario-dialog", () => ({ ExcluirUsuarioPanel: () => null }));

import FreelancersPage from "../page";

describe("Freelancers — modal no celular", () => {
  it("'Ver perfil' rola por dentro (o X e o 'Fechar' não somem)", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FreelancersPage />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getAllByTitle("Ver perfil")[0]);

    const bio = screen.getByText("Trabalho com eventos há 5 anos.");
    expect(bio.closest(".overflow-y-auto")).toHaveClass("max-h-[88vh]");
    expect(screen.getAllByRole("button", { name: "Fechar" }).length).toBeGreaterThan(0);
  });
});

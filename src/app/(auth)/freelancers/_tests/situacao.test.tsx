import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderExportItem } from "@/modules/admin/infrastructure/providers-export-api";
import type { ProvidersStatusCounts } from "@/modules/admin/infrastructure/admin-api";

const { state, mutation } = vi.hoisted(() => ({
  state: {
    rows: [] as unknown[],
    counts: undefined as unknown,
    calls: [] as unknown[],
  },
  mutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const base = {
  userId: "user-1",
  providerGlobalId: "pg-1",
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
  useAdminProviders: (params: unknown) => {
    state.calls.push(params);
    return {
      data: { data: state.rows, total: state.rows.length },
      isLoading: false,
      isError: false,
      isFetching: false,
    };
  },
  useAdminBanFreelancer: mutation,
  useProvidersFilterOptions: () => ({ data: { ufs: [], cities: [], services: [] } }),
  useClearLowPriority: mutation,
}));
vi.mock("@/modules/admin/application/use-providers-status-counts", () => ({
  useProvidersStatusCounts: () => ({ data: state.counts }),
}));
vi.mock("@/modules/admin/application/use-admin-update-provider", () => ({ useAdminUpdateProvider: mutation }));
vi.mock("@/modules/admin/application/use-cities-catalog", () => ({ useCitiesCatalog: () => ({ data: [] }) }));
vi.mock("@/modules/admin/application/use-admin-catalog", () => ({ useCatalogRoles: () => ({ data: [] }) }));
vi.mock("@/modules/admin/application/use-export-providers", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useExportProviders: () => ({ exportCsv: vi.fn(), isExporting: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("../_components/completeness-card", () => ({ CompletenessCard: () => null }));
vi.mock("@/components/admin/orientation/orientation-provider-section", () => ({ OrientationProviderSection: () => null }));
vi.mock("@/components/admin/provider/pix-key-replace-section", () => ({ PixKeyReplaceSection: () => null }));
vi.mock("@/components/admin/excluir-usuario-dialog", () => ({ ExcluirUsuarioPanel: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import FreelancersPage from "../page";

const COUNTS: ProvidersStatusCounts = {
  active: 12345,
  banned: 21,
  deletionRequested: 40,
  profileInactive: 0,
  inactive: 61,
  suspended: 8,
  noOrientation: 9000,
  deleted: 905,
  total: 12406,
  computedAt: "2026-11-18T17:32:00.000Z",
};

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <FreelancersPage />
    </QueryClientProvider>,
  );
}

/** A linha da tabela (o DataTable também desenha cartões para o celular). */
function rowOf(name: string): HTMLElement {
  const row = screen
    .getAllByText(name)
    .map((el) => el.closest("tr"))
    .find((tr): tr is HTMLTableRowElement => Boolean(tr));
  if (!row) throw new Error(`sem linha para ${name}`);
  return row;
}

function lastStatus() {
  return (state.calls[state.calls.length - 1] as { status?: string }).status;
}

beforeEach(() => {
  state.rows = [];
  state.counts = undefined;
  state.calls = [];
});

describe("Freelancers — situação da conta (D5, fatia B)", () => {
  it("API nova: coluna Conta; quem pediu exclusão sai como 'Exclusão pedida' (não Bloqueado) e não dá para banir", () => {
    state.counts = COUNTS;
    state.rows = [
      { ...base, id: "p-ana", name: "Ana Souza", accountStatus: "ACTIVE", banned: false,
        suspension: { endsAt: "2026-11-21T03:00:00.000Z", requiresConversation: true } },
      { ...base, id: "p-bia", name: "Bia Lima", accountStatus: "DELETION_REQUESTED", banned: false, isActive: false, suspension: null },
      { ...base, id: "p-caio", name: "Caio Reis", accountStatus: "BANNED", banned: true, isActive: false, suspension: null },
    ] as unknown as ProviderExportItem[];
    renderPage();
    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent?.trim());
    expect(headers).toContain("Conta");
    expect(headers).not.toContain("Status");
    const bia = rowOf("Bia Lima");
    expect(within(bia).getByText("Exclusão pedida")).toBeInTheDocument();
    expect(within(bia).queryByText("Bloqueado")).not.toBeInTheDocument();
    const biaBan = within(bia).getByTitle("Pediu para excluir a conta: não dá para banir nem desbanir.");
    expect(biaBan).toBeDisabled();
    const ana = rowOf("Ana Souza");
    expect(within(ana).getByText("Ativa")).toBeInTheDocument();
    expect(within(ana).getByText("Suspensa, volta em sáb 21/11 depois da conversa")).toBeInTheDocument();
    const caio = rowOf("Caio Reis");
    expect(within(caio).getByText("Banida")).toBeInTheDocument();
    expect(within(caio).getByTitle("Desbanir")).toBeEnabled();
  });

  it("faixa de contadores: legenda com a conta, cada número filtra, Excluídas é link", () => {
    state.counts = COUNTS;
    renderPage();
    const strip = screen.getByRole("region", { name: "Freelancers por situação" });
    expect(within(strip).getByText(/Cada conta entra uma vez: Ativas \(12\.345\) \+ Banidas \(21\) \+ Exclusão pedida \(40\) = 12\.406/)).toBeInTheDocument();
    // Perfil desativado = 0: fora da faixa e da legenda.
    expect(within(strip).queryByRole("button", { name: /Perfil desativado/ })).not.toBeInTheDocument();
    fireEvent.click(within(strip).getByRole("button", { name: /Banidas/ }));
    expect(lastStatus()).toBe("banned");
    fireEvent.click(within(strip).getByRole("button", { name: /Suspensas agora/ }));
    expect(lastStatus()).toBe("suspended");
    fireEvent.click(within(strip).getByRole("button", { name: /Sem aula/ }));
    expect(state.calls[state.calls.length - 1]).toMatchObject({ status: "active", orientation: "PENDING" });
    expect(within(strip).getByRole("link", { name: /Usuários → Excluídos/ })).toHaveAttribute("href", "/usuarios");
    // O "?" diz a regra de "inativas" e de "excluídas" (D2 e D3 com o Denner).
    expect(within(strip).getByText(/não abre o app há 30 dias/)).toBeInTheDocument();
  });

  it("API antiga (sem contadores nem accountStatus): rótulo e filtro de antes, sem faixa", () => {
    state.rows = [
      { ...base, id: "p-bia", name: "Bia Lima", banned: true, isActive: false },
    ] as unknown as ProviderExportItem[];
    renderPage();
    expect(screen.queryByRole("region", { name: "Freelancers por situação" })).not.toBeInTheDocument();
    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent?.trim());
    expect(headers).toContain("Status");
    expect(headers).not.toContain("Conta");
    const bia = rowOf("Bia Lima");
    expect(within(bia).getByText("Bloqueado")).toBeInTheDocument();
    const select = screen.getAllByRole("combobox").find((el) =>
      within(el).queryByRole("option", { name: "Inativo" }),
    )!;
    expect(within(select).queryByRole("option", { name: "Banidas" })).not.toBeInTheDocument();
  });
});

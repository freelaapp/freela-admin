import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getCommissionStatement: vi.fn() }));
vi.mock("../infrastructure/consultant-commissions-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getCommissionStatement: api.getCommissionStatement,
}));

import { useCommissionBalances } from "./use-admin-consultant-commissions";

const page = (openInCents: number) => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: 1,
  balances: { openInCents, paidInCents: 0 },
});

let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  api.getCommissionStatement.mockReset();
});

describe("useCommissionBalances", () => {
  it("trocar de consultor não mostra o saldo do anterior enquanto o novo carrega", async () => {
    let resolveB: (v: unknown) => void = () => {};
    api.getCommissionStatement.mockImplementation((id: string) =>
      id === "A" ? Promise.resolve(page(31500)) : new Promise((r) => (resolveB = r)),
    );
    const { result, rerender } = renderHook(({ id }) => useCommissionBalances(id), {
      wrapper,
      initialProps: { id: "A" as string | null },
    });
    await waitFor(() => expect(result.current.data?.openInCents).toBe(31500));

    rerender({ id: "B" });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();

    resolveB(page(4200));
    await waitFor(() => expect(result.current.data?.openInCents).toBe(4200));
    expect(api.getCommissionStatement).toHaveBeenCalledWith("B", { page: 1, pageSize: 1 });
  });

  it("sem id não consulta", () => {
    renderHook(() => useCommissionBalances(null), { wrapper });
    expect(api.getCommissionStatement).not.toHaveBeenCalled();
  });
});

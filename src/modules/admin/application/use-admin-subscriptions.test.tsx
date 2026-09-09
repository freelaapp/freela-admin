import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../infrastructure/subscriptions-api", () => ({
  adjustQuota: vi.fn().mockResolvedValue({}),
  assignPlan: vi.fn().mockResolvedValue({}),
  extendPeriod: vi.fn().mockResolvedValue({}),
  getSubscription: vi.fn(),
  grantCourtesy: vi.fn().mockResolvedValue({}),
  listSubscriptions: vi.fn(),
  revokeCourtesy: vi.fn().mockResolvedValue({}),
}));

import { adjustQuota, extendPeriod, grantCourtesy } from "../infrastructure/subscriptions-api";
import { useSubscriptionMutations } from "./use-admin-subscriptions";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

/**
 * A API tem whitelist de campos: mandar `storeId` no corpo derrubava a chamada
 * inteira com 'O campo "storeId" não é permitido' (relato do dono, 09/09/2026,
 * no "Aplicar" da cota). O storeId vai na URL; o corpo leva só o que o DTO aceita.
 */
describe("useSubscriptionMutations — corpo sem storeId", () => {
  it("ajustar cota manda só { delta, note }", async () => {
    const { result } = renderHook(() => useSubscriptionMutations("store-1"), { wrapper });
    await act(async () => {
      result.current.quota.mutate({ storeId: "store-1", delta: 5 });
    });
    await waitFor(() => expect(adjustQuota).toHaveBeenCalled());
    const [storeId, body] = vi.mocked(adjustQuota).mock.calls[0];
    expect(storeId).toBe("store-1");
    expect(body).not.toHaveProperty("storeId");
    expect(body.delta).toBe(5);
  });

  it("estender ciclo manda só { days, note }", async () => {
    const { result } = renderHook(() => useSubscriptionMutations("store-1"), { wrapper });
    await act(async () => {
      result.current.extend.mutate({ storeId: "store-1", days: 30, note: "x" });
    });
    await waitFor(() => expect(extendPeriod).toHaveBeenCalled());
    const [, body] = vi.mocked(extendPeriod).mock.calls[0];
    expect(body).not.toHaveProperty("storeId");
    expect(body).toMatchObject({ days: 30, note: "x" });
  });

  it("cortesia manda só { planCode, months, note }", async () => {
    const { result } = renderHook(() => useSubscriptionMutations("store-1"), { wrapper });
    await act(async () => {
      result.current.courtesy.mutate({ storeId: "store-1", months: 1, planCode: "BASIC" });
    });
    await waitFor(() => expect(grantCourtesy).toHaveBeenCalled());
    const [, body] = vi.mocked(grantCourtesy).mock.calls[0];
    expect(body).not.toHaveProperty("storeId");
    expect(body).toMatchObject({ months: 1, planCode: "BASIC" });
  });
});

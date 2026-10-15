import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../infrastructure/billing-mode-api", () => ({
  getBillingModeSettings: vi.fn(),
  updateBillingMode: vi.fn(),
}));

import { getBillingModeSettings, updateBillingMode } from "../infrastructure/billing-mode-api";
import {
  billingModeKeys,
  useAdminBillingMode,
  useUpdateAdminBillingMode,
} from "./use-admin-billing-mode";
import { contractorSettingsKeys } from "./use-admin-contractor-settings";

let qc: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("useAdminBillingMode", () => {
  it("lê o modo de cobrança da empresa", async () => {
    vi.mocked(getBillingModeSettings).mockResolvedValue({ mode: "PREPAID" } as never);
    const { result } = renderHook(() => useAdminBillingMode("u1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getBillingModeSettings).toHaveBeenCalledWith("u1");
    expect(result.current.data).toEqual({ mode: "PREPAID" });
  });

  it("403 (sem FINANCE) não tenta de novo", async () => {
    const forbidden = Object.assign(new Error("403"), {
      isAxiosError: true,
      response: { status: 403, data: { error: { code: "FORBIDDEN" } } },
    });
    vi.mocked(getBillingModeSettings).mockRejectedValue(forbidden);
    qc = new QueryClient();
    const { result } = renderHook(() => useAdminBillingMode("u1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getBillingModeSettings).toHaveBeenCalledTimes(1);
  });
});

describe("useUpdateAdminBillingMode", () => {
  it("salvar invalida cobrança, preferências, histórico, a lista de empresas e o Financeiro", async () => {
    const saved = { mode: "INVOICED_7", editable: true };
    vi.mocked(updateBillingMode).mockResolvedValue(saved as never);
    const invalidate = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useUpdateAdminBillingMode("u1"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ billingMode: "INVOICED_7", reason: "Contrato assinado" });
    });

    expect(updateBillingMode).toHaveBeenCalledWith("u1", {
      billingMode: "INVOICED_7",
      reason: "Contrato assinado",
    });
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: billingModeKeys.settings("u1") }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: contractorSettingsKeys.settings("u1") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: contractorSettingsKeys.history("u1") });
    // O selo da tabela de Empresas lê o modo da lista.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "contractors"] });
    // O Financeiro: faturas e "Empresas faturadas" (admin/billing), o resumo e os pagamentos.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "billing"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "finance"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "payments"] });
    // A resposta do PATCH já é o estado novo: a aba não pisca com o valor antigo.
    expect(qc.getQueryData(billingModeKeys.settings("u1"))).toEqual(saved);
  });
});

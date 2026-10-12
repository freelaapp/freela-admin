import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../infrastructure/contractor-settings-api", () => ({
  getContractorSettings: vi.fn(),
  getContractorSettingsHistory: vi.fn(),
  updateContractorSettings: vi.fn(),
}));

import { updateContractorSettings } from "../infrastructure/contractor-settings-api";
import {
  contractorSettingsKeys,
  useUpdateAdminContractorSettings,
} from "./use-admin-contractor-settings";

let qc: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("useUpdateAdminContractorSettings", () => {
  it("salvar invalida settings e history", async () => {
    const saved = { signedContractEnabled: false, rpaEnabled: true, inssRemindersEnabled: true };
    vi.mocked(updateContractorSettings).mockResolvedValue(saved as never);
    const invalidate = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useUpdateAdminContractorSettings("u1"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ signedContractEnabled: false, reason: "Cliente pediu" });
    });

    expect(updateContractorSettings).toHaveBeenCalledWith("u1", {
      signedContractEnabled: false,
      reason: "Cliente pediu",
    });
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: contractorSettingsKeys.settings("u1") }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: contractorSettingsKeys.history("u1") });
    // A resposta do PATCH já é o estado novo: a tela não pisca com o valor antigo.
    expect(qc.getQueryData(contractorSettingsKeys.settings("u1"))).toEqual(saved);
  });
});

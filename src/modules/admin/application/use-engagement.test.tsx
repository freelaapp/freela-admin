import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get: vi.fn() }),
}));
vi.mock("../infrastructure/engagement-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../infrastructure/engagement-api")>();
  return {
    ...actual,
    getEngagementOverview: vi.fn(),
    listEngagementFreelancers: vi.fn(),
    listEngagementContractors: vi.fn(),
    getFreelancerEngagement: vi.fn(),
    getContractorEngagement: vi.fn(),
  };
});

import {
  getEngagementOverview,
  listEngagementContractors,
  listEngagementFreelancers,
} from "../infrastructure/engagement-api";
import { defaultFilters } from "./engagement-filters";
import { SAMPLE_OVERVIEW } from "./engagement.test-fixtures";
import { retryUnlessClientError, useEngagementOverview, useEngagementPeople } from "./use-engagement";

const NOW = new Date("2026-10-07T15:00:00.000Z");

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe("useEngagementOverview", () => {
  it("personalizado incompleto não dispara a consulta", () => {
    const { result } = renderHook(
      () => useEngagementOverview({ ...defaultFilters(NOW), period: "custom", from: "" }),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(getEngagementOverview).not.toHaveBeenCalled();
  });

  it("filtro pronto consulta e devolve a visão geral", async () => {
    vi.mocked(getEngagementOverview).mockResolvedValue(SAMPLE_OVERVIEW);
    const { result } = renderHook(() => useEngagementOverview(defaultFilters(NOW)), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(SAMPLE_OVERVIEW));
  });
});

describe("useEngagementPeople", () => {
  it("sem a área (enabled=false) não chama a API", () => {
    renderHook(() => useEngagementPeople("freelancer", defaultFilters(NOW), { page: 1, limit: 25 }, false), {
      wrapper,
    });
    expect(listEngagementFreelancers).not.toHaveBeenCalled();
  });

  it("empresas chamam a lista de empresas", async () => {
    vi.mocked(listEngagementContractors).mockResolvedValue({ rows: [], total: 0, page: 1, limit: 25, truncated: false });
    renderHook(() => useEngagementPeople("contractor", defaultFilters(NOW), { page: 1, limit: 25 }), { wrapper });
    await waitFor(() =>
      expect(listEngagementContractors).toHaveBeenCalledWith(expect.objectContaining({ period: "this_month" }), {
        page: 1,
        limit: 25,
      }),
    );
    expect(listEngagementFreelancers).not.toHaveBeenCalled();
  });
});

describe("retryUnlessClientError", () => {
  it("não repete 4xx (ficha inexistente, sem permissão); repete rede/5xx até 2 vezes", () => {
    const http = (status: number) => new AxiosError("x", "ERR", undefined, undefined, { status } as never);
    expect(retryUnlessClientError(0, http(404))).toBe(false);
    expect(retryUnlessClientError(0, http(403))).toBe(false);
    expect(retryUnlessClientError(0, http(500))).toBe(true);
    expect(retryUnlessClientError(2, http(500))).toBe(false);
    expect(retryUnlessClientError(0, new Error("rede"))).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, post: vi.fn(), patch: vi.fn() }),
}));

import { getInsuranceCoverages } from "./insurance-api";

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ data: { data: [], meta: { total: 0, page: 1, pageSize: 20 } } });
});

describe("getInsuranceCoverages — período De/Até", () => {
  it("o dia vai com o fuso de Brasília: De = 00:00 e Até = 23:59:59.999 (inclusive)", async () => {
    await getInsuranceCoverages({ from: "2026-10-01", to: "2026-10-15" });

    expect(get).toHaveBeenCalledWith("/coverages", {
      params: { from: "2026-10-01T00:00:00-03:00", to: "2026-10-15T23:59:59.999-03:00" },
    });
    // A API faz `new Date(valor)`: os limites caem às 03:00 UTC do dia 1 e às
    // 02:59:59.999 UTC do dia 16 — o dia 15 de Brasília inteiro entra.
    const { params } = get.mock.calls[0][1];
    expect(new Date(params.from).toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(new Date(params.to).toISOString()).toBe("2026-10-16T02:59:59.999Z");
  });

  it("campo vazio não vira filtro; os outros filtros seguem iguais", async () => {
    await getInsuranceCoverages({ status: "", module: "bars-restaurants", from: "", to: "2026-10-15", page: 2 });

    expect(get).toHaveBeenCalledWith("/coverages", {
      params: { module: "bars-restaurants", to: "2026-10-15T23:59:59.999-03:00", page: 2 },
    });
  });

  it("instante já completo (com hora) segue como veio", async () => {
    await getInsuranceCoverages({ from: "2026-10-01T10:00:00.000Z" });

    expect(get).toHaveBeenCalledWith("/coverages", { params: { from: "2026-10-01T10:00:00.000Z" } });
  });
});

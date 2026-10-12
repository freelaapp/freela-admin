import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, patch } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, patch }),
}));

import {
  getContractorSettings,
  getContractorSettingsHistory,
  updateContractorSettings,
} from "./contractor-settings-api";

describe("contractor-settings-api", () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { data: { ok: true } } });
    patch.mockReset().mockResolvedValue({ data: { data: { ok: true } } });
  });

  it("GET, PATCH (com reason) e history em /contractors/:userId/settings", async () => {
    await getContractorSettings("u 1");
    expect(get).toHaveBeenCalledWith("/contractors/u%201/settings");

    await updateContractorSettings("u1", { signedContractEnabled: false, reason: "Cliente pediu" });
    expect(patch).toHaveBeenCalledWith("/contractors/u1/settings", {
      signedContractEnabled: false,
      reason: "Cliente pediu",
    });

    await getContractorSettingsHistory("u/1");
    expect(get).toHaveBeenLastCalledWith("/contractors/u%2F1/settings/history");
  });

  it("desembrulha `res.data.data`", async () => {
    await expect(getContractorSettings("u1")).resolves.toEqual({ ok: true });
    await expect(
      updateContractorSettings("u1", { rpaEnabled: true, reason: "motivo" }),
    ).resolves.toEqual({ ok: true });
    get.mockResolvedValueOnce({ data: { data: [{ id: "h1" }] } });
    await expect(getContractorSettingsHistory("u1")).resolves.toEqual([{ id: "h1" }]);
  });
});

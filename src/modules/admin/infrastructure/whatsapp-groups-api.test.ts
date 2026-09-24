import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post, put, del } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, post, put, delete: del }),
}));

import { deleteAdminGroup, getAdminGroups, getGroupSettings, updateGroupSettings } from "./whatsapp-groups-api";

describe("whatsapp-groups-api (painel de grupos)", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    put.mockReset();
    del.mockReset();
  });

  it("lista os grupos do painel; refresh vira ?refresh=true", async () => {
    const list = { instance: { connected: true }, directory: { ok: true, checkedAt: "2026-09-23T17:32:00.000Z" }, groups: [] };
    get.mockResolvedValue({ data: { data: list } });

    await expect(getAdminGroups()).resolves.toEqual(list);
    expect(get).toHaveBeenLastCalledWith("/groups", { params: {} });

    await getAdminGroups({ refresh: true });
    expect(get).toHaveBeenLastCalledWith("/groups", { params: { refresh: "true" } });
  });

  it("exclui pelo id (codificado)", async () => {
    del.mockResolvedValue({ data: { data: { id: "a/b", leftGroup: true } } });
    await expect(deleteAdminGroup("a/b")).resolves.toEqual({ id: "a/b", leftGroup: true });
    expect(del).toHaveBeenCalledWith("/groups/a%2Fb");
  });

  it("lê e grava os números padrão", async () => {
    get.mockResolvedValue({ data: { data: { defaultPhones: ["5511915375766"] } } });
    put.mockResolvedValue({ data: { data: { defaultPhones: ["5511915375766"] } } });

    await expect(getGroupSettings()).resolves.toEqual({ defaultPhones: ["5511915375766"] });
    expect(get).toHaveBeenCalledWith("/settings");

    await expect(updateGroupSettings(["(11) 91537-5766"])).resolves.toEqual({ defaultPhones: ["5511915375766"] });
    expect(put).toHaveBeenCalledWith("/settings", { defaultPhones: ["(11) 91537-5766"] });
  });
});

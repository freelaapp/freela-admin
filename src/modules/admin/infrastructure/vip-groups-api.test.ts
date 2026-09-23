import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post, del } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, post, delete: del }),
}));

import {
  addVipGroupMember,
  ensureVipGroup,
  getVipGroupDetail,
  getVipGroups,
  markVipMemberRemovedOnWhatsapp,
  removeVipGroupMember,
  searchVipGroupProviders,
  syncVipGroup,
} from "./vip-groups-api";

describe("vip-groups-api", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    del.mockReset();
  });

  it("lista lojas com filtro aparado e devolve [] sem data", async () => {
    get.mockResolvedValueOnce({ data: { data: [{ contractorUserId: "loja-1" }] } });
    await expect(getVipGroups("  coco ")).resolves.toEqual([{ contractorUserId: "loja-1" }]);
    expect(get).toHaveBeenCalledWith("", { params: { search: "coco" } });

    get.mockResolvedValueOnce({ data: {} });
    await expect(getVipGroups()).resolves.toEqual([]);
    expect(get).toHaveBeenLastCalledWith("", { params: {} });
  });

  it("busca freelas", async () => {
    get.mockResolvedValueOnce({ data: { data: [{ providerGlobalId: "pg-1" }] } });
    await expect(searchVipGroupProviders("ana")).resolves.toEqual([{ providerGlobalId: "pg-1" }]);
    expect(get).toHaveBeenCalledWith("/providers", { params: { search: "ana" } });
  });

  it("detalhe, criar grupo e sincronizar", async () => {
    get.mockResolvedValueOnce({ data: { data: { contractorUserId: "loja-1", members: [] } } });
    post.mockResolvedValueOnce({ data: { data: { status: "ACTIVE" } } });
    post.mockResolvedValueOnce({ data: { data: { attempted: 1, added: 1, failed: 0 } } });

    await expect(getVipGroupDetail("loja-1")).resolves.toEqual({ contractorUserId: "loja-1", members: [] });
    await expect(ensureVipGroup("loja-1")).resolves.toEqual({ status: "ACTIVE" });
    await expect(syncVipGroup("loja-1")).resolves.toEqual({ attempted: 1, added: 1, failed: 0 });

    expect(get).toHaveBeenCalledWith("/loja-1/members");
    expect(post).toHaveBeenNthCalledWith(1, "/loja-1/ensure");
    expect(post).toHaveBeenNthCalledWith(2, "/loja-1/sync");
  });

  it("adicionar, remover e marcar feito", async () => {
    post.mockResolvedValue({ data: { data: { id: "m1" } } });
    del.mockResolvedValue({ data: { data: { id: "m1" } } });

    await addVipGroupMember("loja-1", "pg-1");
    await removeVipGroupMember("loja-1", "pg-1");
    await markVipMemberRemovedOnWhatsapp("loja-1", "pg-1");

    expect(post).toHaveBeenNthCalledWith(1, "/loja-1/members", { providerGlobalId: "pg-1" });
    expect(del).toHaveBeenCalledWith("/loja-1/members/pg-1");
    expect(post).toHaveBeenNthCalledWith(2, "/loja-1/members/pg-1/removed-on-whatsapp");
  });
});

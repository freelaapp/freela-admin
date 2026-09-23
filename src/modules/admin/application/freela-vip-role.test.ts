import { describe, expect, it } from "vitest";
import { VIP_PERMISSIONS_ANY, vipRoleFromPermissions } from "./freela-vip-role";

const has = (granted: string[]) => (p: string) => granted.includes(p);

describe("vipRoleFromPermissions", () => {
  it("VIP_ADMIN administra, vê PII, não vê antecedentes", () => {
    expect(vipRoleFromPermissions(has(["VIP_ADMIN"]))).toEqual({
      canAdmin: true, canBackground: false, readOnly: false, canView: true,
    });
  });
  it("VIP_READONLY só lê", () => {
    expect(vipRoleFromPermissions(has(["VIP_READONLY"]))).toEqual({
      canAdmin: false, canBackground: false, readOnly: true, canView: true,
    });
  });
  it("VIP_BACKGROUND sozinho vê a área e o bloco de antecedentes, sem administrar", () => {
    expect(vipRoleFromPermissions(has(["VIP_BACKGROUND"]))).toEqual({
      canAdmin: false, canBackground: true, readOnly: true, canView: true,
    });
  });
  it("ADMIN + BACKGROUND = tudo; nenhuma = não vê", () => {
    expect(vipRoleFromPermissions(has(["VIP_ADMIN", "VIP_BACKGROUND"]))).toEqual({
      canAdmin: true, canBackground: true, readOnly: false, canView: true,
    });
    expect(vipRoleFromPermissions(has([]))).toEqual({
      canAdmin: false, canBackground: false, readOnly: true, canView: false,
    });
  });
  it("lista de permissões da área", () => {
    expect([...VIP_PERMISSIONS_ANY]).toEqual(["VIP_ADMIN", "VIP_READONLY", "VIP_BACKGROUND"]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mesmo padrão de consultant-api.test.ts: o client autenticado é falso e
// guarda o prefixo com que foi criado.
const client = vi.hoisted(() => ({ prefixes: [] as string[], post: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: (prefix: string) => {
    client.prefixes.push(prefix);
    return { post: client.post, get: vi.fn() };
  },
}));
vi.mock("@/modules/shared/infrastructure/http-client", () => ({ publicApi: { post: vi.fn() } }));

import { ADMIN_ME_API_PREFIX, changeAdminPasswordApi } from "./auth.api";

beforeEach(() => {
  client.post.mockReset().mockResolvedValue({ data: { data: { message: "ok" } } });
});

describe("changeAdminPasswordApi", () => {
  it("POST /v1/admins/me/change-password (plural, como /v1/admins/login e /v1/admins/me)", async () => {
    await changeAdminPasswordApi("Temp@1234", "Nova@Senha9");

    // Caminho errado também responde 404, e o 404 deixa entrar: o caminho é travado aqui.
    expect(ADMIN_ME_API_PREFIX).toBe("/v1/admins/me");
    expect(client.prefixes).toContain("/v1/admins/me");
    expect(client.prefixes).not.toContain("/v1/admin/me");
    expect(client.post).toHaveBeenCalledWith("/change-password", {
      currentPassword: "Temp@1234",
      newPassword: "Nova@Senha9",
    });
  });
});
